"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui";
import { cn } from "@/lib/format";

const TIERS = [
  {
    name: "Starter",
    monthly: 149,
    for: "A single store getting started",
    features: ["1 location", "Up to 5 suppliers", "Catalogue extraction (CSV & PDF)", "Product matching review", "Total cost comparison", "Purchase order preparation"],
  },
  {
    name: "Growth",
    monthly: 399,
    for: "Multi-store retailers buying weekly",
    featured: true,
    features: ["Up to 5 locations", "Unlimited suppliers", "Everything in Starter", "Replenishment recommendations", "Procurement assistant", "Order status tracking & email send", "Procurement analytics"],
  },
  {
    name: "Wholesale",
    monthly: null,
    for: "Wholesalers & distributors",
    features: ["Catalogue publishing for retail accounts", "Terms modelling on retailer baskets", "Account onboarding workflows", "CRM integration (HubSpot)", "SSO & audit log export", "Dedicated onboarding"],
  },
];

export function PricingTiers() {
  const [annual, setAnnual] = useState(true);
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm" role="group" aria-label="Billing period">
          {[
            [false, "Monthly"],
            [true, "Annual · 2 months free"],
          ].map(([v, label]) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={annual === v}
              onClick={() => setAnnual(v as boolean)}
              className={cn("rounded-md px-4 py-1.5 font-medium", annual === v ? "bg-white text-navy-900 shadow-sm" : "text-slate-500")}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={cn(
              "flex flex-col rounded-2xl border p-7",
              t.featured ? "border-navy-900 bg-navy-900 text-white shadow-xl" : "border-slate-200 bg-white",
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className={cn("text-lg font-semibold", t.featured ? "text-white" : "text-navy-900")}>{t.name}</h2>
              {t.featured && <span className="rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">Most chosen</span>}
            </div>
            <p className={cn("mt-1 text-sm", t.featured ? "text-slate-300" : "text-slate-500")}>{t.for}</p>
            <p className="mt-6">
              {t.monthly ? (
                <>
                  <span className="tabular text-4xl font-semibold">${annual ? Math.round((t.monthly * 10) / 12) : t.monthly}</span>
                  <span className={cn("text-sm", t.featured ? "text-slate-300" : "text-slate-500")}> /month{annual && ", billed annually"}</span>
                </>
              ) : (
                <span className="text-4xl font-semibold">Custom</span>
              )}
            </p>
            <ul className="mt-7 flex-1 space-y-2.5 text-[14px]">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <span className={t.featured ? "text-accent-100" : "text-accent-600"}>✓</span>
                  <span className={t.featured ? "text-slate-200" : "text-slate-700"}>{f}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href={`/demo?plan=${t.name.toLowerCase()}`} variant={t.featured ? "accent" : "secondary"} className="mt-8 w-full">
              {t.monthly ? "Start with a demo" : "Talk to sales"}
            </ButtonLink>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-[12px] text-slate-500">Prices in USD, excluding applicable taxes.</p>
    </section>
  );
}
