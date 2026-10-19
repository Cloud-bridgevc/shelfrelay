import type { Metadata } from "next";
import { loadDemoDataset } from "@/lib/demo/load";
import { findMatches } from "@/lib/engine";
import { PublicCompare } from "./public-compare";

export const metadata: Metadata = { title: "Live supplier comparison" };

const FILES = [
  ["northgate-provisions.csv", "Northgate Provisions", "CSV · case prices with 5+ tier"],
  ["harbor-vine-distribution.tsv", "Harbor & Vine Distribution", "TSV · unit prices"],
  ["meridian-cash-carry.csv", "Meridian Cash & Carry", "Semicolon CSV · unlabelled price"],
  ["fieldstone-direct.csv", "Fieldstone Direct", "CSV · some prices TBC, no terms"],
];

export default async function ComparePage() {
  const data = await loadDemoDataset();
  const groups = findMatches(data.items)
    .filter((m) => m.status === "proposed")
    .map((m) => ({ id: m.id, label: m.label, itemIds: m.itemIds, baseUnit: m.baseUnit }));
  const seed: [string, number][] = [
    ["northgate:NP-1001", 192],
    ["northgate:NP-1003", 36],
    ["northgate:NP-1011", 96],
    ["northgate:NP-1012", 24],
  ];
  const basket: Record<string, number> = {};
  for (const [id, units] of seed) {
    const g = groups.find((x) => x.itemIds.includes(id));
    const it = data.items.find((i) => i.id === id);
    if (g && it?.pack) basket[g.id] = units * it.pack.unitSize;
  }

  return (
    <div className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-600">Interactive demo</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">Live supplier comparison</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Four fictional suppliers, four catalogue formats. Change quantities or remove suppliers and watch ShelfRelay normalize pack sizes,
            apply tier prices, discounts and delivery rules, and find the lowest total that meets each minimum order.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {FILES.map(([f, name, desc]) => (
              <a
                key={f}
                href={`/demo-catalogues/${f}`}
                download
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 hover:border-slate-300 hover:bg-white"
              >
                <span className="font-medium text-navy-900">{name}</span> · {desc} ↓
              </a>
            ))}
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <PublicCompare suppliers={data.suppliers} items={data.items} groups={groups} initialBasket={basket} />
        <p className="mt-8 text-center text-[12px] text-slate-500">
          All suppliers, products, prices and terms here are fictional demonstration data. This view only includes high-confidence matches; flagged matches are reviewed in the workspace.
        </p>
      </div>
    </div>
  );
}
