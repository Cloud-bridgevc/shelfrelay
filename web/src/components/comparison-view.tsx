"use client";

import { useMemo } from "react";
import {
  compare,
  comparisonUnit,
  describePack,
  explainComparison,
  type CatalogueItem,
  type LineQuote,
  type Plan,
  type ProductGroup,
  type Supplier,
} from "@/lib/engine";
import { cn, money, qty } from "@/lib/format";
import { Badge, Card, CardHeader, ProvenanceBadge } from "./ui";

interface Props {
  suppliers: Supplier[];
  items: CatalogueItem[];
  groups: ProductGroup[];
  unconfirmed?: Set<string>;
  basket: Record<string, number>;
  onBasketChange: (groupId: string, base: number) => void;
  onAddPlanToOrders?: (plan: Plan) => void;
}

/** Input unit for a group: whole sellable units when every item shares a unit size. */
function inputUnit(group: ProductGroup, items: Map<string, CatalogueItem>) {
  const packs = group.itemIds.map((id) => items.get(id)?.pack).filter(Boolean);
  const sizes = new Set(packs.map((p) => p!.unitSize));
  const base = group.baseUnit ?? "each";
  if (packs.length && sizes.size === 1) {
    const size = packs[0]!.unitSize;
    const label = base === "each" ? "units" : `units of ${base === "ml" ? (size >= 1000 ? `${size / 1000}L` : `${size}ml`) : size >= 1000 ? `${size / 1000}kg` : `${size}g`}`;
    return { factor: size, label };
  }
  const cu = comparisonUnit(base);
  return { factor: cu.factor, label: cu.label };
}

export function ComparisonView({ suppliers, items, groups, unconfirmed, basket, onBasketChange, onAddPlanToOrders }: Props) {
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const sName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;

  const cmp = useMemo(
    () =>
      compare(
        Object.entries(basket).map(([groupId, required]) => ({ groupId, required })),
        groups,
        items,
        suppliers,
      ),
    [basket, groups, items, suppliers],
  );
  const explanation = useMemo(() => explainComparison(cmp, groups, suppliers, items), [cmp, groups, suppliers, items]);
  const activeGroups = groups.filter((g) => (basket[g.id] ?? 0) > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Basket"
          description="Set the quantity you need. Cases are rounded up per supplier pack size."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[12px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Product group</th>
                <th className="px-3 py-2.5 font-medium">Quantity</th>
                <th className="px-3 py-2.5 font-medium">Equivalent</th>
                <th className="px-5 py-2.5 font-medium">Offered by</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const u = inputUnit(g, itemMap);
                const base = basket[g.id] ?? 0;
                return (
                  <tr key={g.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-navy-900">{g.label}</span>
                        {unconfirmed?.has(g.id) && (
                          <Badge tone="ai" title="Proposed by the matcher with high confidence; not yet confirmed by your team.">
                            ✦ Unconfirmed match
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          inputMode="decimal"
                          aria-label={`Quantity of ${g.label}`}
                          className="tabular h-9 w-24 rounded-md border border-slate-300 px-2 text-right text-sm"
                          value={base ? +(base / u.factor).toFixed(2) : ""}
                          placeholder="0"
                          onChange={(e) => onBasketChange(g.id, Math.max(0, Number(e.target.value) || 0) * u.factor)}
                        />
                        <span className="text-[12px] text-slate-500">{u.label}</span>
                      </label>
                    </td>
                    <td className="tabular px-3 py-2.5 text-slate-500">{base ? qty(base, g.baseUnit) : "—"}</td>
                    <td className="px-5 py-2.5 text-[12px] text-slate-500">
                      {g.itemIds.map((id) => sName(itemMap.get(id)?.supplierId ?? "")).join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {activeGroups.length > 0 && (
        <>
          <Card>
            <CardHeader
              title="Normalized line comparison"
              description="Price per litre, kilogram or unit, from each supplier's stated case or unit price."
              action={<ProvenanceBadge kind="calculated" />}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[12px] uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5 font-medium">Product</th>
                    {suppliers.map((s) => (
                      <th key={s.id} className="px-3 py-2.5 font-medium">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeGroups.map((g) => {
                    const row = cmp.lineMatrix[g.id] ?? {};
                    const quotes = Object.values(row).filter(Boolean) as LineQuote[];
                    const lowest = quotes.length > 1 ? Math.min(...quotes.map((q) => q.unitCost)) : null;
                    const cu = comparisonUnit(g.baseUnit ?? "each").label;
                    return (
                      <tr key={g.id} className="border-b border-slate-50 align-top last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium text-navy-900">{g.label}</p>
                          <p className="tabular text-[12px] text-slate-500">{qty(basket[g.id], g.baseUnit)} needed</p>
                        </td>
                        {suppliers.map((s) => {
                          const q = row[s.id];
                          const it = g.itemIds.map((id) => itemMap.get(id)).find((i) => i?.supplierId === s.id);
                          if (!q) {
                            return (
                              <td key={s.id} className="px-3 py-3 text-[12px] text-slate-400">
                                {it ? (it.casePrice == null ? "No price stated" : "Pack size not stated") : "Not listed"}
                              </td>
                            );
                          }
                          const isLow = lowest != null && Math.abs(q.unitCost - lowest) < 1e-9;
                          return (
                            <td key={s.id} className={cn("px-3 py-3", isLow && "bg-accent-50/70")}>
                              <p className={cn("tabular font-semibold", isLow ? "text-accent-700" : "text-navy-900")}>
                                {money(q.unitCost)}
                                <span className="font-normal text-slate-500">/{cu}</span>
                              </p>
                              <p className="tabular mt-0.5 text-[12px] text-slate-500">
                                {q.cases} × {money(q.casePrice)} = {money(q.lineCost)}
                              </p>
                              <p className="text-[11px] text-slate-400">{it?.pack ? describePack(it.pack) : ""}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {q.tierApplied && <Badge tone="navy">{q.tierApplied}+ case price</Badge>}
                                {it?.casePriceBasis === "derived_from_unit" && (
                                  <Badge tone="neutral" title="Supplier states a unit price; case price = unit price × units per case.">
                                    From unit price
                                  </Badge>
                                )}
                                {q.overbuy > 0 && (
                                  <Badge tone="amber" title="Whole cases exceed the quantity needed.">
                                    +{qty(q.overbuy, g.baseUnit)}
                                  </Badge>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader
                title="Order totals by supplier"
                description="Goods subtotal, volume discounts, delivery and minimum order checks per stated terms."
                action={<ProvenanceBadge kind="calculated" />}
              />
              <div className="divide-y divide-slate-100">
                {cmp.singleSupplier.map((p, i) => {
                  const s = suppliers[i];
                  const o = p.orders[0];
                  return (
                    <div key={s.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-navy-900">{s.name}</p>
                        <p className="text-[12px] text-slate-500">
                          {o ? `${o.lines.length} of ${activeGroups.length} lines` : "Offers none of these lines"}
                          {o && o.discount > 0 && ` · −${money(o.discount)} discount`}
                          {o && ` · delivery ${o.delivery == null ? "not stated" : o.deliveryWaived ? "waived" : money(o.delivery)}`}
                        </p>
                      </div>
                      <p className="tabular text-right font-semibold text-navy-900">{o ? money(p.total) : "—"}</p>
                      {o && (
                        <div className="col-span-2 flex flex-wrap gap-1">
                          {p.missingGroups.length > 0 && <Badge tone="neutral">{p.missingGroups.length} line(s) unavailable</Badge>}
                          {o.meetsMinimum === false && <Badge tone="red">Below minimum by {money(o.shortfall)}</Badge>}
                          {o.meetsMinimum === true && <Badge tone="green">Meets minimum</Badge>}
                          {o.minimumOrderValue == null && <Badge tone="amber">Minimum not stated</Badge>}
                          {o.delivery == null && <Badge tone="amber">Delivery not stated</Badge>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="border-navy-900/15">
              <CardHeader
                title="Recommended plan"
                description="Lowest calculated total that meets stated minimums."
                action={<ProvenanceBadge kind="calculated" />}
              />
              {cmp.best ? (
                <div className="px-5 py-4">
                  <p className="tabular text-3xl font-semibold text-navy-900">{money(cmp.best.total)}</p>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {cmp.best.kind === "split" ? `Split across ${cmp.best.orders.length} suppliers` : "Single supplier"}
                    {!cmp.best.complete && " · some terms not stated"}
                    {!cmp.best.valid && " · does not meet all minimums"}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {cmp.best.orders.map((o) => (
                      <li key={o.supplierId} className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium text-navy-900">{sName(o.supplierId)}</span>
                          <span className="tabular font-semibold">{money(o.total)}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {o.lines.map((l) => `${groups.find((g) => g.id === l.groupId)?.label} (${l.cases} cs)`).join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {cmp.best.missingGroups.length > 0 && (
                    <p className="mt-3 text-[12px] text-red-700">
                      Not covered: {cmp.best.missingGroups.map((g) => groups.find((x) => x.id === g)?.label).join(", ")}
                    </p>
                  )}
                  {onAddPlanToOrders && (
                    <button
                      type="button"
                      onClick={() => onAddPlanToOrders(cmp.best!)}
                      className="mt-4 inline-flex h-9 items-center rounded-md bg-navy-900 px-3.5 text-[13px] font-medium text-white hover:bg-navy-800"
                    >
                      Add plan to draft purchase orders
                    </button>
                  )}
                  <p className="mt-3 text-[11px] text-slate-400">
                    Best plan found by searching supplier combinations; excludes taxes and any charges a supplier has not stated.
                  </p>
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-slate-500">Add quantities to compare.</p>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Why this recommendation"
              description="Rule-based explanation generated from the figures above."
              action={<ProvenanceBadge kind="calculated" />}
            />
            <ul className="space-y-2 px-5 py-4 text-[13.5px] leading-relaxed text-slate-700">
              {explanation.map((e, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      {activeGroups.length === 0 && (
        <p className="text-center text-sm text-slate-500">Enter a quantity for at least one product group to see a comparison.</p>
      )}
    </div>
  );
}
