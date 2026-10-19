"use client";

import { Fragment, useState } from "react";
import { quoteLine, recommend, type CatalogueItem } from "@/lib/engine";
import { useWorkspace } from "@/lib/workspace";
import { cn, money, num } from "@/lib/format";
import { Badge, buttonClass, Card, CardHeader, PageHeader, ProvenanceBadge } from "@/components/ui";

export default function ReplenishmentPage() {
  const { state, item, supplier, groupOfItem, update, addToOrder } = useWorkspace();
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const t = state.targets;

  const rows = state.stock.map((s) => {
    const stocked = item(s.itemId);
    const group = groupOfItem(s.itemId);
    // Only offer suppliers whose sellable unit is the same size as what the store sells.
    const options: CatalogueItem[] = (group?.itemIds ?? [s.itemId])
      .map((id) => item(id))
      .filter((i): i is CatalogueItem => !!i && !!i.pack && !!stocked?.pack && i.pack.baseUnit === stocked.pack.baseUnit && i.pack.unitSize === stocked.pack.unitSize);
    const sourceId = state.replenishSource[s.itemId] ?? s.itemId;
    const source = options.find((o) => o.id === sourceId) ?? stocked;
    const sup = source ? supplier(source.supplierId) : undefined;
    const rec = recommend({ ...s, groupId: s.itemId }, t, sup?.terms.planningLeadTimeDays ?? null, source?.pack?.unitsPerCase ?? null);
    const quote = source && rec.suggestedCases && source.pack ? quoteLine(source, rec.suggestedCases * source.pack.unitsPerCase * source.pack.unitSize) : null;
    return { s, stocked, options, source, sup, rec, quote };
  });
  const toOrder = rows.filter((r) => r.rec.status === "order" && r.quote && r.source);

  const setTarget = (k: keyof typeof t, v: number) => update((st) => ({ ...st, targets: { ...st.targets, [k]: Math.max(0, v) } }));

  return (
    <>
      <PageHeader
        eyebrow="Inventory & replenishment"
        title="Replenishment"
        description="Order quantities from recorded stock counts and sales, your stock targets, and each supplier's planning lead time."
        actions={
          toOrder.length > 0 && (
            <button
              type="button"
              className={buttonClass("primary", "sm")}
              onClick={() => {
                for (const r of toOrder) addToOrder(r.source!.supplierId, { itemId: r.source!.id, cases: r.rec.suggestedCases, casePrice: r.quote!.casePrice });
                setFlash(`Added ${toOrder.length} line(s) to draft purchase orders.`);
              }}
            >
              Add all {toOrder.length} to draft POs
            </button>
          )
        }
      />
      {flash && <p className="mb-5 rounded-lg bg-accent-50 px-4 py-2.5 text-[13px] text-accent-700">{flash}</p>}

      <Card className="mb-6">
        <CardHeader title="Stock targets" description="Applied to every product. These are your settings, not supplier data." action={<ProvenanceBadge kind="user" />} />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          {(
            [
              ["safetyDays", "Safety stock (days)"],
              ["coverDays", "Cover after delivery (days)"],
              ["minHistoryDays", "Minimum sales history (days)"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="text-[13px] font-medium text-navy-900">
              {label}
              <input type="number" min={0} value={t[k]} onChange={(e) => setTarget(k, Number(e.target.value) || 0)} className="tabular mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm" />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recommendations"
          description="Demand is the average of recorded daily sales. Quantities are estimates for your review."
          action={<ProvenanceBadge kind="estimate" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 font-medium">Order from</th>
                <th className="px-3 py-2.5 text-right font-medium">On hand</th>
                <th className="px-3 py-2.5 text-right font-medium">On order</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg / day</th>
                <th className="px-3 py-2.5 text-right font-medium">Days cover</th>
                <th className="px-3 py-2.5 text-right font-medium">Reorder at</th>
                <th className="px-3 py-2.5 text-right font-medium">Suggested</th>
                <th className="px-3 py-2.5 text-right font-medium">Est. cost</th>
                <th className="px-5 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, stocked, options, source, sup, rec, quote }) => (
                <Fragment key={s.itemId}>
                  <tr className={cn("border-b border-slate-50 align-top", rec.status === "order" && "bg-accent-50/30")}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy-900">{stocked?.name}</p>
                      <p className="text-[11px] text-slate-500">Counted {s.countedOn} · {s.dailySales.length}d history</p>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={source?.id}
                        aria-label={`Supplier for ${stocked?.name}`}
                        onChange={(e) => update((st) => ({ ...st, replenishSource: { ...st.replenishSource, [s.itemId]: e.target.value } }))}
                        className="h-8 max-w-[200px] rounded-md border border-slate-300 px-2 text-[12.5px]"
                      >
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {supplier(o.supplierId)?.name} · {o.pack?.unitsPerCase}/case
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Lead time {sup?.terms.planningLeadTimeDays == null ? <span className="text-est-700">not set</span> : `${sup.terms.planningLeadTimeDays}d`}
                      </p>
                    </td>
                    <td className="tabular px-3 py-3 text-right">{s.onHand}</td>
                    <td className="tabular px-3 py-3 text-right">{s.onOrder}</td>
                    <td className="tabular px-3 py-3 text-right">{rec.avgDailySales == null ? "—" : num(rec.avgDailySales, 1)}</td>
                    <td className={cn("tabular px-3 py-3 text-right", rec.daysOfCover != null && rec.daysOfCover < (sup?.terms.planningLeadTimeDays ?? 0) + t.safetyDays && "font-semibold text-red-700")}>
                      {rec.daysOfCover == null ? "—" : num(rec.daysOfCover, 1)}
                    </td>
                    <td className="tabular px-3 py-3 text-right">{rec.reorderPoint == null ? "—" : Math.ceil(rec.reorderPoint)}</td>
                    <td className="px-3 py-3 text-right">
                      {rec.status === "order" ? (
                        <>
                          <p className="tabular font-semibold text-navy-900">
                            {rec.suggestedCases} case{rec.suggestedCases === 1 ? "" : "s"}
                          </p>
                          <p className="tabular text-[11px] text-slate-500">{rec.suggestedCases * (rec.unitsPerCase ?? 0)} units</p>
                        </>
                      ) : rec.status === "ok" ? (
                        <Badge tone="green">Stock OK</Badge>
                      ) : rec.status === "insufficient_data" ? (
                        <Badge tone="neutral">Not enough history</Badge>
                      ) : (
                        <Badge tone="amber">Set lead time</Badge>
                      )}
                    </td>
                    <td className="tabular px-3 py-3 text-right">{quote ? money(quote.lineCost) : "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setOpen(open === s.itemId ? null : s.itemId)} className="text-[12px] font-medium text-navy-700 hover:underline">
                          {open === s.itemId ? "Hide" : "Why?"}
                        </button>
                        {rec.status === "order" && quote && source && (
                          <button
                            type="button"
                            onClick={() => {
                              addToOrder(source.supplierId, { itemId: source.id, cases: rec.suggestedCases, casePrice: quote.casePrice });
                              setFlash(`Added ${stocked?.name} to the ${sup?.name} draft PO.`);
                            }}
                            className="text-[12px] font-medium text-accent-700 hover:underline"
                          >
                            Add to PO
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open === s.itemId && (
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <td colSpan={10} className="px-5 py-3">
                        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                          <ul className="space-y-1 text-[12.5px] text-slate-700">
                            {rec.explanation.map((e) => (
                              <li key={e}>• {e}</li>
                            ))}
                            {quote?.tierApplied && <li>• Includes the supplier&apos;s {quote.tierApplied}+ case price.</li>}
                          </ul>
                          <Sparkline values={s.dailySales} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 280;
  const h = 56;
  const max = Math.max(1, ...values);
  const bw = w / Math.max(values.length, 1);
  return (
    <figure>
      <svg width={w} height={h} role="img" aria-label="Recorded daily sales" className="block">
        {values.map((v, i) => (
          <rect key={i} x={i * bw + 1} y={h - (v / max) * (h - 4)} width={Math.max(1, bw - 2)} height={(v / max) * (h - 4)} rx={1} fill="#2a4d7c" opacity={0.75} />
        ))}
      </svg>
      <figcaption className="mt-1 text-[11px] text-slate-500">Recorded daily unit sales, last {values.length} days (max {max})</figcaption>
    </figure>
  );
}
