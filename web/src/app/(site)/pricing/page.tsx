import type { Metadata } from "next";
import { PricingTiers } from "./tiers";

export const metadata: Metadata = { title: "Pricing" };

const FAQ = [
  ["What counts as a supplier?", "Any business whose catalogue you import. Re-uploading an updated price list from the same supplier doesn't count again."],
  ["Which catalogue formats are supported?", "CSV, TSV and spreadsheet exports today, plus PDF and scanned price lists via document extraction. Anything ShelfRelay can't read confidently is flagged for review."],
  ["Does ShelfRelay place orders with suppliers?", "ShelfRelay prepares purchase orders and tracks their status. You send them through your normal channel, or by email from ShelfRelay on Growth and above."],
  ["How is AI usage billed?", "Matching assistance and the procurement assistant are included in each plan's fair-use allowance. There are no per-question charges."],
];

export default function PricingPage() {
  return (
    <div className="bg-white">
      <section className="mx-auto max-w-7xl px-4 pt-16 text-center sm:px-6">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-600">Pricing</p>
        <h1 className="mx-auto mt-2 max-w-2xl text-4xl font-semibold tracking-tight text-navy-900">Priced per business, not per purchase</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Start with the suppliers you already use. Every plan includes catalogue extraction, matching review and total-cost comparison.
        </p>
      </section>
      <PricingTiers />
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1fr_2fr]">
          <h2 className="text-2xl font-semibold tracking-tight text-navy-900">Questions</h2>
          <dl className="space-y-6">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="font-medium text-navy-900">{q}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
