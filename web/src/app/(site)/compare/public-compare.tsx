"use client";

import { useState } from "react";
import type { CatalogueItem, ProductGroup, Supplier } from "@/lib/engine";
import { ComparisonView } from "@/components/comparison-view";
import { ProvenanceLegend } from "@/components/ui";
import { cn, money } from "@/lib/format";

export function PublicCompare({
  suppliers,
  items,
  groups,
  initialBasket,
}: {
  suppliers: Supplier[];
  items: CatalogueItem[];
  groups: ProductGroup[];
  initialBasket: Record<string, number>;
}) {
  const [basket, setBasket] = useState(initialBasket);
  const [enabled, setEnabled] = useState<string[]>(suppliers.map((s) => s.id));
  const active = suppliers.filter((s) => enabled.includes(s.id));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-navy-900">Suppliers in this comparison</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {suppliers.map((s) => {
            const on = enabled.includes(s.id);
            const t = s.terms;
            return (
              <label
                key={s.id}
                className={cn(
                  "cursor-pointer rounded-lg border p-3.5 text-[13px] transition",
                  on ? "border-navy-700 bg-navy-50/60" : "border-slate-200 bg-white opacity-70",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setEnabled((xs) => (on ? xs.filter((x) => x !== s.id) : [...xs, s.id]))}
                    className="h-4 w-4 accent-[#0b1f3a]"
                  />
                  <span className="font-medium text-navy-900">{s.name}</span>
                </span>
                <span className="mt-2 block text-slate-500">
                  Delivery {t.deliveryFee == null ? "not stated" : t.deliveryFee === 0 ? "included" : money(t.deliveryFee)}
                  {t.freeDeliveryThreshold != null && `, free ≥ ${money(t.freeDeliveryThreshold)}`}
                </span>
                <span className="block text-slate-500">
                  Minimum {t.minimumOrderValue == null ? "not stated" : t.minimumOrderValue === 0 ? "none" : money(t.minimumOrderValue)}
                  {t.volumeDiscounts.map((d) => ` · ${d.percent}% off ≥ ${money(d.minSubtotal)}`)}
                </span>
              </label>
            );
          })}
        </div>
        <ProvenanceLegend kinds={["imported", "calculated", "ai"]} className="mt-4 border-t border-slate-100 pt-4" />
      </div>
      <ComparisonView
        suppliers={active}
        items={items}
        groups={groups}
        unconfirmed={new Set(groups.map((g) => g.id))}
        basket={basket}
        onBasketChange={(g, v) => setBasket((b) => ({ ...b, [g]: v }))}
      />
    </div>
  );
}
