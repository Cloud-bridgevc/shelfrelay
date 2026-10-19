"use client";

import Link from "next/link";
import { useState } from "react";
import { ComparisonView } from "@/components/comparison-view";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader, ProvenanceLegend } from "@/components/ui";

export default function ComparePage() {
  const { state, groups, unconfirmed, setBasket, addToOrder } = useWorkspace();
  const [added, setAdded] = useState("");
  const needsReview = state.matches.filter((m) => m.status === "needs_review").length;

  return (
    <>
      <PageHeader
        eyebrow="Supplier comparison"
        title="Total cost comparison"
        description="Normalized unit costs and full order totals, using each supplier's stated prices and terms."
      />
      <ProvenanceLegend kinds={["imported", "calculated", "ai"]} className="mb-5" />
      {needsReview > 0 && (
        <p className="mb-5 rounded-lg border border-amber-200 bg-est-50 px-4 py-2.5 text-[13px] text-est-700">
          {needsReview} flagged match(es) are excluded until reviewed.{" "}
          <Link href="/app/matching" className="font-medium underline">
            Review matches
          </Link>
        </p>
      )}
      {added && <p className="mb-5 rounded-lg bg-accent-50 px-4 py-2.5 text-[13px] text-accent-700">{added}</p>}
      <ComparisonView
        suppliers={state.suppliers}
        items={state.items}
        groups={groups}
        unconfirmed={unconfirmed}
        basket={state.basket}
        onBasketChange={setBasket}
        onAddPlanToOrders={(plan) => {
          for (const o of plan.orders) for (const l of o.lines) addToOrder(o.supplierId, { itemId: l.itemId, cases: l.cases, casePrice: l.casePrice, groupId: l.groupId });
          setAdded(`Added ${plan.orders.reduce((n, o) => n + o.lines.length, 0)} line(s) to draft purchase orders.`);
        }}
      />
    </>
  );
}
