import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoForm } from "./demo-form";

export const metadata: Metadata = { title: "Request a demo" };

export default function DemoPage() {
  return (
    <div className="bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-600">Request a demo</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-navy-900">See your suppliers on one comparable basis</h1>
          <p className="mt-4 text-slate-600">
            A 30-minute walkthrough with a procurement specialist. Bring two or three current price lists if you can, and we&apos;ll show how they compare.
          </p>
          <ul className="mt-8 space-y-4 text-[15px] text-slate-700">
            {[
              "How catalogue extraction handles your price list formats",
              "Matching review for products that differ in pack size or brand",
              "Landed-cost comparison with your delivery terms and minimums",
              "Replenishment from your stock and sales records",
            ].map((x) => (
              <li key={x} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[11px] font-bold text-accent-700">✓</span>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <Suspense>
          <DemoForm />
        </Suspense>
      </div>
    </div>
  );
}
