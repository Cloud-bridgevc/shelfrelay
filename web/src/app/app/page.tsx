"use client";

import Link from "next/link";
import { useMemo } from "react";
import { compare, findMissingInfo, recommend } from "@/lib/engine";
import { useWorkspace } from "@/lib/workspace";
import { money } from "@/lib/format";
import { Badge, Card, CardHeader, PageHeader, ProvenanceLegend, Stat } from "@/components/ui";

export default function OverviewPage() {
  const { state, groups, item, groupOfItem } = useWorkspace();

  const missing = useMemo(() => findMissingInfo(state.suppliers, state.items), [state.suppliers, state.items]);
  const review = state.matches.filter((m) => m.status === "needs_review");
  const cmp = useMemo(
    () => compare(Object.entries(state.basket).map(([groupId, required]) => ({ groupId, required })), groups, state.items, state.suppliers),
    [state.basket, groups, state.items, state.suppliers],
  );
  const reorder = state.stock.filter((s) => {
    const src = item(state.replenishSource[s.itemId] ?? s.itemId);
    const sup = state.suppliers.find((x) => x.id === src?.supplierId);
    const r = recommend({ ...s, groupId: s.itemId }, state.targets, sup?.terms.planningLeadTimeDays ?? null, src?.pack?.unitsPerCase ?? null);
    return r.status === "order";
  });
  const openOrders = state.orders.filter((o) => !["draft", "received", "cancelled"].includes(o.status));

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Larkspur Market procurement"
        description="What needs attention across your suppliers, catalogues and orders."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Catalogue items" value={state.items.length} hint={`${state.suppliers.length} suppliers · ${state.catalogues.length} files`} provenance="imported" />
        <Stat label="Matches to review" value={review.length} hint={`${groups.length} active product groups`} provenance="ai" />
        <Stat label="Lines to reorder" value={reorder.length} hint={`of ${state.stock.length} tracked products`} provenance="estimate" />
        <Stat
          label="Current basket, best plan"
          value={cmp.best ? money(cmp.best.total) : "—"}
          hint={cmp.best ? `${cmp.best.orders.length} supplier(s)${cmp.best.complete ? "" : " · some terms unstated"}` : "No basket set"}
          provenance="calculated"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Missing information"
            description="Values suppliers haven't stated. ShelfRelay excludes them from totals rather than guessing."
            action={<Badge tone={missing.some((m) => m.severity === "blocking") ? "red" : "amber"}>{missing.length} open</Badge>}
          />
          <ul className="divide-y divide-slate-100">
            {missing.slice(0, 8).map((m, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3 text-[13.5px]">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${m.severity === "blocking" ? "bg-red-500" : "bg-amber-400"}`} aria-hidden />
                <span className="flex-1 text-slate-700">{m.message}</span>
                <Link href={m.itemId ? "/app/catalogues" : "/app/suppliers"} className="shrink-0 text-[12px] font-medium text-navy-700 hover:underline">
                  Resolve
                </Link>
              </li>
            ))}
          </ul>
          {missing.length > 8 && <p className="border-t border-slate-100 px-5 py-3 text-[12px] text-slate-500">+ {missing.length - 8} more</p>}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Next steps" />
            <ul className="divide-y divide-slate-100 text-[13.5px]">
              <Task href="/app/matching" label="Review flagged product matches" count={review.length} />
              <Task href="/app/replenishment" label="Check replenishment suggestions" count={reorder.length} />
              <Task href="/app/orders" label="Finish draft purchase orders" count={state.orders.filter((o) => o.status === "draft").length} />
              <Task href="/app/tracking" label="Update orders in progress" count={openOrders.length} />
            </ul>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-navy-900">How to read values</p>
            <ProvenanceLegend className="mt-3 flex-col !items-start !gap-2" />
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recently tracked stock" description="From the store's recorded counts (demo data)." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[12px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 text-right font-medium">On hand</th>
                <th className="px-3 py-2.5 text-right font-medium">On order</th>
                <th className="px-5 py-2.5 font-medium">Product group</th>
              </tr>
            </thead>
            <tbody>
              {state.stock.slice(0, 6).map((s) => (
                <tr key={s.itemId} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 text-navy-900">{item(s.itemId)?.name ?? s.itemId}</td>
                  <td className="tabular px-3 py-2.5 text-right">{s.onHand}</td>
                  <td className="tabular px-3 py-2.5 text-right">{s.onOrder}</td>
                  <td className="px-5 py-2.5 text-slate-500">{groupOfItem(s.itemId)?.label ?? "Not matched"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Task({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
        <span className="text-slate-700">{label}</span>
        <span className={`tabular rounded-full px-2 text-[12px] font-semibold ${count ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
      </Link>
    </li>
  );
}
