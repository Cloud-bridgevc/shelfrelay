import Link from "next/link";
import { loadDemoDataset } from "@/lib/demo/load";
import { describePack, quoteLine } from "@/lib/engine";
import { money } from "@/lib/format";
import { Badge, ButtonLink, Card, ProvenanceBadge, ProvenanceLegend } from "@/components/ui";

const FEATURES = [
  {
    title: "Catalogue extraction",
    body: "Read SKUs, descriptions, pack sizes, case and unit prices, tiers and terms from CSV, spreadsheets and PDF price lists. Every value keeps a link back to its source row.",
    output: "imported" as const,
  },
  {
    title: "Product matching",
    body: "Find equivalent products across suppliers even when names, brands or case counts differ. Variant and size differences are flagged for your review, never silently merged.",
    output: "ai" as const,
  },
  {
    title: "Total cost comparison",
    body: "Normalize to price per litre, kilogram or unit, then add delivery charges, volume discounts, tier pricing and minimum order checks to see the true order cost.",
    output: "calculated" as const,
  },
  {
    title: "Replenishment recommendations",
    body: "Turn recorded stock counts and sales into order quantities using your own safety stock, cover days and lead times, rounded to each supplier's case size.",
    output: "estimate" as const,
  },
  {
    title: "Procurement assistant",
    body: "Ask why one supplier is cheaper, which prices are missing, or what the options are for this week's order. Answers are grounded in your imported data and cite it.",
    output: "ai" as const,
  },
];

const STEPS = [
  ["Upload", "Drop in supplier catalogues and terms sheets. Files are stored in your private workspace."],
  ["Review matches", "Confirm proposed equivalents and resolve flagged differences in one queue."],
  ["Compare", "See normalized and landed costs per supplier, and the lowest-cost plan that meets minimums."],
  ["Order", "Prepare purchase orders per supplier and track them from sent to received."],
];

export default async function HomePage() {
  const data = await loadDemoDataset();
  const waterIds = ["northgate:NP-1001", "harbor:HV-20110", "meridian:MCC-0451"];
  const rows = waterIds
    .map((id) => data.items.find((i) => i.id === id)!)
    .map((it) => ({ it, q: quoteLine(it, 330 * 96)!, s: data.suppliers.find((s) => s.id === it.supplierId)! }));
  const low = Math.min(...rows.map((r) => r.q.unitCost));

  return (
    <>
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-slate-200 ring-1 ring-inset ring-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden />
              Procurement intelligence for independent retail
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Know the true cost of every order before you place it.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              ShelfRelay consolidates supplier catalogues, matches equivalent products, and compares landed costs across pack sizes,
              delivery charges and minimums, so independent retailers and wholesalers buy with the same clarity as national chains.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/demo" variant="accent" size="lg">
                Request a demo
              </ButtonLink>
              <ButtonLink href="/compare" variant="inverse" size="lg">
                Try the live comparison
              </ButtonLink>
            </div>
            <p className="mt-6 text-[13px] text-slate-400">No supplier prices are invented. Every figure is imported, calculated, or clearly marked as a suggestion.</p>
          </div>

          <Card className="self-center border-white/10 bg-white text-slate-800 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Matched product</p>
                <p className="font-semibold text-navy-900">Clearbrook Sparkling Water 330ml</p>
              </div>
              <Badge tone="ai">✦ Proposed match · 3 suppliers</Badge>
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map(({ it, q, s }) => (
                <div key={it.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900">{s.name}</p>
                    <p className="text-[12px] text-slate-500">
                      {it.pack && describePack(it.pack)} · {money(it.casePrice)}/case
                      {it.casePriceBasis === "derived_from_unit" && " (from unit price)"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`tabular text-lg font-semibold ${q.unitCost === low ? "text-accent-600" : "text-navy-900"}`}>
                      {money(q.unitCost)}
                      <span className="text-[12px] font-normal text-slate-500">/L</span>
                    </p>
                    {q.unitCost === low && <p className="text-[11px] font-medium text-accent-600">Lowest per litre</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-[12px] text-slate-500">
              <ProvenanceBadge kind="imported" /> prices
              <ProvenanceBadge kind="calculated" /> per-litre cost
              <span className="ml-auto">Fictional demo suppliers</span>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 text-[13px] font-medium uppercase tracking-wider text-slate-400 sm:px-6">
          <span>Independent grocers</span>
          <span>Convenience</span>
          <span>Specialty food</span>
          <span>Health & beauty</span>
          <span>Regional wholesalers</span>
        </div>
      </section>

      <section id="platform" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-600">Platform</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-navy-900">Five AI capabilities, one auditable workflow</h2>
            <p className="mt-4 text-slate-600">
              Each capability labels its output, so your team always knows what came from a supplier, what ShelfRelay calculated, and what needs a human decision.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Card key={f.title} className="flex flex-col p-6">
                <div className="flex items-center justify-between">
                  <span className="tabular text-[13px] font-semibold text-slate-400">0{i + 1}</span>
                  <ProvenanceBadge kind={f.output} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-navy-900">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{f.body}</p>
              </Card>
            ))}
            <Card className="flex flex-col justify-between bg-navy-900 p-6 text-white">
              <div>
                <h3 className="text-lg font-semibold">See it on real-shaped data</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-300">
                  The demo workspace loads four fictional supplier catalogues with different formats, pack sizes and terms.
                </p>
              </div>
              <Link href="/app" className="mt-6 text-sm font-medium text-accent-100 hover:text-white">
                Open the demo workspace →
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-navy-50/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-navy-900">From price list to purchase order</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {STEPS.map(([t, b], i) => (
              <li key={t} className="relative rounded-xl border border-slate-200 bg-white p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-[13px] font-semibold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-navy-900">{t}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="trust" className="scroll-mt-20 bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-600">Data & AI principles</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-navy-900">Clear about what is known, calculated, and suggested</h2>
            <ul className="mt-8 space-y-5">
              {[
                ["No invented prices, availability or dates", "If a supplier hasn't stated a price, delivery charge, minimum or lead time, ShelfRelay shows it as missing and excludes it from totals."],
                ["Humans confirm equivalence", "Matches are proposals until your team confirms them. Differing variants, brands and sizes are always routed to review."],
                ["Traceable to the source", "Each imported value links to the file and row it came from, and every calculation can be expanded to show its working."],
                ["Grounded assistant", "The assistant only answers from your workspace data and says when information is missing, rather than guessing."],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[11px] font-bold text-accent-700">✓</span>
                  <div>
                    <p className="font-medium text-navy-900">{t}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-slate-600">{b}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <Card className="self-start p-6">
            <p className="text-sm font-semibold text-navy-900">Every value carries a label</p>
            <ProvenanceLegend className="mt-4 flex-col !items-start" />
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-600">
              <p className="font-medium text-navy-900">Example</p>
              <p className="mt-1">
                Harbor & Vine lists sparkling water at a <strong>unit price</strong>. ShelfRelay multiplies by the stated 12-can case to get a case price,
                labels it <em>from unit price</em>, and links back to row 1 of the supplier&apos;s file.
              </p>
            </div>
          </Card>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 pb-20 sm:px-6 md:grid-cols-2">
          <UseCase
            href="/retailers"
            eyebrow="For independent retailers"
            title="Buy like a chain, stay independent"
            points={["Compare every supplier on landed cost", "Replenish from your own sales history", "Hit free-delivery thresholds deliberately"]}
          />
          <UseCase
            href="/wholesalers"
            eyebrow="For wholesalers & distributors"
            title="Make your catalogue easy to buy from"
            points={["Publish clean, structured price lists", "See how your terms compare on landed cost", "Onboard retail accounts faster"]}
          />
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="text-center text-[13px] font-semibold uppercase tracking-wider text-slate-500">Built on AWS</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-5">
            {[
              ["Amazon S3", "Encrypted catalogue storage"],
              ["Amazon Textract", "Tables from PDF price lists"],
              ["Amazon Bedrock", "Match review & explanations"],
              ["PostgreSQL", "Products, suppliers, orders"],
              ["AWS Lambda", "Event-driven processing"],
            ].map(([t, b]) => (
              <div key={t} className="rounded-lg border border-slate-200 bg-white px-3 py-4">
                <p className="font-semibold text-navy-900">{t}</p>
                <p className="mt-1 text-[12px] text-slate-500">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy-900">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-white">See your own suppliers side by side</h2>
            <p className="mt-2 text-slate-300">Bring two or three current price lists to a 30-minute walkthrough.</p>
          </div>
          <ButtonLink href="/demo" variant="accent" size="lg">
            Request a demo
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function UseCase({ href, eyebrow, title, points }: { href: string; eyebrow: string; title: string; points: string[] }) {
  return (
    <Link href={href} className="group rounded-xl border border-slate-200 bg-white p-8 transition hover:border-navy-600/40 hover:shadow-md">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-600">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-navy-900">{title}</h3>
      <ul className="mt-5 space-y-2 text-[15px] text-slate-600">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-accent-600">—</span>
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm font-medium text-navy-800 group-hover:text-accent-700">Explore use case →</p>
    </Link>
  );
}
