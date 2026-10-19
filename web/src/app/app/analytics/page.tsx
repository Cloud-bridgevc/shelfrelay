"use client";

import { useMemo, useState } from "react";
import { compare, comparisonUnit } from "@/lib/engine";
import { useWorkspace } from "@/lib/workspace";
import { priceDraft } from "@/lib/orders";
import { money, pct } from "@/lib/format";
import { Card, CardHeader, PageHeader, ProvenanceBadge, Stat } from "@/components/ui";

interface Bar {
  label: string;
  value: number;
  display: string;
  detail?: string;
}

/** Single-series horizontal bars: one hue, recessive axis, value label at the bar end, hover detail. */
function BarList({ bars, max, emptyText }: { bars: Bar[]; max?: number; emptyText: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!bars.length) return <p className="px-5 py-8 text-center text-sm text-slate-500">{emptyText}</p>;
  const top = max ?? Math.max(...bars.map((b) => b.value), 1);
  return (
    <ul className="space-y-3 px-5 py-4" role="list">
      {bars.map((b, i) => (
        <li key={b.label} className="relative" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-slate-700">{b.label}</span>
            <span className="tabular font-medium text-navy-900">{b.display}</span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full bg-navy-700 transition-[width]" style={{ width: `${Math.max(1.5, (b.value / top) * 100)}%`, opacity: hover == null || hover === i ? 1 : 0.55 }} />
          </div>
          {hover === i && b.detail && (
            <div role="tooltip" className="absolute right-0 top-full z-10 mt-1 rounded-md bg-navy-950 px-2.5 py-1.5 text-[12px] text-white shadow-lg">
              {b.detail}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsPage() {
  const { state, groups, supplier, item } = useWorkspace();

  const spend = useMemo(() => {
    const by = new Map<string, { total: number; count: number }>();
    for (const o of state.orders) {
      if (["draft", "ready", "cancelled"].includes(o.status)) continue;
      const { priced } = priceDraft(o, supplier(o.supplierId), item);
      const cur = by.get(o.supplierId) ?? { total: 0, count: 0 };
      by.set(o.supplierId, { total: cur.total + (priced?.total ?? 0), count: cur.count + 1 });
    }
    return [...by].map(([id, v]) => ({ label: supplier(id)?.name ?? id, value: v.total, display: money(v.total), detail: `${v.count} order(s) sent or received` })).sort((a, b) => b.value - a.value);
  }, [state.orders, supplier, item]);

  const spread = useMemo(() => {
    return groups
      .map((g) => {
        const costs = g.itemIds
          .map((id) => item(id))
          .filter((i) => i?.pack && i.casePrice != null)
          .map((i) => ({ s: supplier(i!.supplierId)?.name ?? "", c: (i!.casePrice! / (i!.pack!.unitsPerCase * i!.pack!.unitSize)) * comparisonUnit(i!.pack!.baseUnit).factor }));
        if (costs.length < 2) return null;
        costs.sort((a, b) => a.c - b.c);
        const lo = costs[0];
        const hi = costs[costs.length - 1];
        const gap = (hi.c - lo.c) / lo.c;
        const u = comparisonUnit(g.baseUnit ?? "each").label;
        return { label: g.label, value: gap, display: pct(gap), detail: `${lo.s} ${money(lo.c)}/${u} → ${hi.s} ${money(hi.c)}/${u}` };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.value - a.value);
  }, [groups, item, supplier]);

  const completeness = useMemo(
    () =>
      state.suppliers.map((s) => {
        const its = state.items.filter((i) => i.supplierId === s.id);
        const ok = its.filter((i) => i.casePrice != null && i.pack).length;
        const terms = [s.terms.deliveryFee ?? s.terms.freeDeliveryThreshold, s.terms.minimumOrderValue, s.terms.statedLeadTime].filter((v) => v != null).length;
        const v = its.length ? ok / its.length : 0;
        return { label: s.name, value: v, display: `${pct(v)} items · ${terms}/3 terms`, detail: `${ok} of ${its.length} items have price and pack size` };
      }),
    [state.suppliers, state.items],
  );

  const cmp = useMemo(
    () => compare(Object.entries(state.basket).map(([groupId, required]) => ({ groupId, required })), groups, state.items, state.suppliers),
    [state.basket, groups, state.items, state.suppliers],
  );
  const single = cmp.singleSupplier.filter((p) => p.valid && p.missingGroups.length === 0 && p.orders.length).sort((a, b) => a.total - b.total)[0];
  const saving = cmp.best && single ? single.total - cmp.best.total : null;
  const totalSpend = spend.reduce((s, b) => s + b.value, 0);

  return (
    <>
      <PageHeader eyebrow="Procurement analytics" title="Analytics" description="Spend, price dispersion and data quality across your suppliers." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Committed spend" value={money(totalSpend)} hint="Sent, acknowledged and received POs" provenance="calculated" />
        <Stat
          label="Basket saving vs. best single supplier"
          value={saving == null ? "—" : money(Math.max(0, saving))}
          hint={single ? `vs. ${supplier(single.orders[0].supplierId)?.name} alone` : "No single supplier covers the basket"}
          provenance="calculated"
        />
        <Stat label="Comparable product groups" value={groups.length} hint={`${state.matches.filter((m) => m.status === "confirmed").length} confirmed by your team`} />
        <Stat label="Median price gap" value={spread.length ? pct(spread[Math.floor(spread.length / 2)].value) : "—"} hint="Highest vs. lowest per-unit price" provenance="calculated" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Price gap by product group" description="How much more the highest supplier charges per litre, kg or unit than the lowest." action={<ProvenanceBadge kind="calculated" />} />
          <BarList bars={spread} emptyText="Confirm matches to compare price dispersion." />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Spend by supplier" description="Calculated from purchase orders at catalogue prices." action={<ProvenanceBadge kind="calculated" />} />
            <BarList bars={spend} emptyText="No sent purchase orders yet." />
          </Card>
          <Card>
            <CardHeader title="Catalogue completeness" description="Share of items with both a stated price and pack size, plus stated key terms." />
            <BarList bars={completeness} max={1} emptyText="No suppliers." />
          </Card>
        </div>
      </div>
    </>
  );
}
