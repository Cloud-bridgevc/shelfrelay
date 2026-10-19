"use client";

import { useMemo, useState } from "react";
import type { ExtractResult } from "@/lib/engine";
import { describePack } from "@/lib/engine";
import { useWorkspace } from "@/lib/workspace";
import { cn, money } from "@/lib/format";
import { Badge, buttonClass, Card, CardHeader, PageHeader, ProvenanceBadge } from "@/components/ui";

const SAMPLES = [
  ["northgate", "northgate-provisions.csv"],
  ["harbor", "harbor-vine-distribution.tsv"],
  ["meridian", "meridian-cash-carry.csv"],
  ["fieldstone", "fieldstone-direct.csv"],
] as const;

const FIELD_LABEL: Record<string, string> = {
  sku: "SKU",
  name: "Description",
  brand: "Brand",
  category: "Category",
  pack: "Pack size",
  casePrice: "Case price",
  unitPrice: "Unit price",
  price: "Price (basis unclear)",
  availability: "Availability",
  tier: "Tier price",
};

export default function CataloguesPage() {
  const { state, importCatalogue, supplier } = useWorkspace();
  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [priceBasis, setPriceBasis] = useState<"" | "case" | "unit">("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  async function run(f: File, basis = priceBasis, sid = supplierId) {
    setBusy(true);
    setError("");
    setDone("");
    const fd = new FormData();
    fd.set("file", f);
    fd.set("supplierId", sid);
    if (basis) fd.set("priceBasis", basis);
    try {
      const res = await fetch("/api/catalogues/extract", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(json.error ?? "Extraction failed.");
      } else setResult(json);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSample(sid: string, name: string) {
    const res = await fetch(`/demo-catalogues/${name}`);
    const blob = await res.blob();
    const f = new File([blob], name, { type: "text/csv" });
    setSupplierId(sid);
    setFile(f);
    setPriceBasis("");
    run(f, "", sid);
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue upload"
        title="Supplier catalogues"
        description="Upload price lists. ShelfRelay maps columns, parses pack sizes and prices, and flags anything it can't read with confidence."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="self-start">
          <CardHeader title="Upload a price list" description="CSV or TSV here; PDF and scans go through Textract in the AWS deployment." />
          <div className="space-y-4 px-5 py-4">
            <label className="block text-[13px] font-medium text-navy-900">
              Supplier
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm">
                {state.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-navy-600/50">
              <span className="text-sm font-medium text-navy-900">{file ? file.name : "Choose a file"}</span>
              <span className="mt-1 text-[12px] text-slate-500">.csv, .tsv, .txt up to 5 MB</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.pdf,.png,.jpg,.jpeg"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setPriceBasis("");
                    run(f, "");
                  }
                }}
              />
            </label>
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Or try a fictional sample</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SAMPLES.map(([sid, name]) => (
                  <button key={name} type="button" onClick={() => loadSample(sid, name)} className="rounded-md border border-slate-200 px-2 py-1 text-[12px] text-navy-800 hover:bg-slate-50">
                    {name}
                  </button>
                ))}
              </div>
            </div>
            {busy && <p className="text-[13px] text-slate-500">Extracting…</p>}
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
            {done && <p className="rounded-md bg-accent-50 px-3 py-2 text-[13px] text-accent-700">{done}</p>}
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          {result && file ? (
            <Card>
              <CardHeader
                title={`Preview · ${file.name}`}
                description={`${result.items.length} items for ${supplier(supplierId)?.name}`}
                action={
                  <button
                    type="button"
                    disabled={!result.items.length || result.needsPriceBasis}
                    className={buttonClass("accent", "sm")}
                    onClick={() => {
                      importCatalogue(
                        { supplierId, file: file.name, method: "csv", itemCount: result.items.length, issues: result.issues },
                        result.items,
                      );
                      setDone(`Imported ${result.items.length} items. Matches were recalculated; check the review queue.`);
                      setResult(null);
                      setFile(null);
                    }}
                  >
                    Import {result.items.length} items
                  </button>
                }
              />
              <div className="space-y-4 px-5 py-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Column mapping</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.mapping.map((m) => (
                      <span key={m.header} className={cn("rounded-md border px-2 py-1 text-[12px]", m.field ? "border-navy-100 bg-navy-50 text-navy-800" : "border-slate-200 text-slate-400 line-through")}>
                        {m.header} → {m.field ? FIELD_LABEL[m.field] + (m.tierMinCases ? ` (${m.tierMinCases}+ cases)` : "") : "ignored"}
                      </span>
                    ))}
                  </div>
                </div>
                {result.needsPriceBasis && (
                  <div className="rounded-lg border border-amber-200 bg-est-50 p-3">
                    <p className="text-[13px] font-medium text-est-700">Is the price column per case or per unit?</p>
                    <p className="text-[12px] text-est-700/80">ShelfRelay won&apos;t guess. Check the supplier&apos;s price list header or ask them.</p>
                    <div className="mt-2 flex gap-2">
                      {(["case", "unit"] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setPriceBasis(b);
                            run(file, b);
                          }}
                          className={buttonClass("secondary", "sm")}
                        >
                          Per {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {result.issues.length > 0 && (
                  <ul className="space-y-1 text-[12.5px]">
                    {result.issues.map((i, k) => (
                      <li key={k} className={i.severity === "error" ? "text-red-700" : "text-est-700"}>
                        {i.row ? `Row ${i.row}: ` : ""}
                        {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ItemTable items={result.items} />
            </Card>
          ) : null}

          <ImportedCatalogues />
        </div>
      </div>
    </>
  );
}

function ItemTable({ items }: { items: ExtractResult["items"] }) {
  return (
    <div className="max-h-[520px] overflow-auto border-t border-slate-100">
      <table className="w-full min-w-[820px] text-[13px]">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-5 py-2 font-medium">SKU</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">Pack</th>
            <th className="px-3 py-2 text-right font-medium">Case price</th>
            <th className="px-3 py-2 font-medium">Tiers</th>
            <th className="px-3 py-2 font-medium">Availability (as stated)</th>
            <th className="px-5 py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-slate-50 align-top">
              <td className="px-5 py-2 font-mono text-[12px] text-slate-600">{i.sku}</td>
              <td className="px-3 py-2 text-navy-900">
                {i.name}
                {i.brand && <span className="block text-[11px] text-slate-500">{i.brand}</span>}
              </td>
              <td className="px-3 py-2">
                {i.pack ? (
                  <>
                    {describePack(i.pack)}
                    <span className="block text-[11px] text-slate-400">“{i.pack.raw}”</span>
                  </>
                ) : (
                  <Badge tone="red">Not stated</Badge>
                )}
              </td>
              <td className="tabular px-3 py-2 text-right">
                {i.casePrice == null ? (
                  <Badge tone="red">No price</Badge>
                ) : (
                  <>
                    {money(i.casePrice)}
                    <span className="mt-0.5 flex justify-end">
                      <ProvenanceBadge
                        kind={i.casePriceBasis === "derived_from_unit" ? "calculated" : "imported"}
                        note={i.casePriceBasis === "derived_from_unit" ? "Unit price × units per case" : "Case price as stated"}
                      />
                    </span>
                  </>
                )}
              </td>
              <td className="tabular px-3 py-2 text-[12px] text-slate-600">{i.tiers.map((t) => `${t.minCases}+: ${money(t.casePrice)}`).join(", ") || "—"}</td>
              <td className="px-3 py-2 text-[12px] text-slate-600">{i.statedAvailability ?? <span className="text-slate-400">Not stated</span>}</td>
              <td className="px-5 py-2 font-mono text-[11px] text-slate-400">
                {i.source.file}#{i.source.row}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportedCatalogues() {
  const { state, supplier } = useWorkspace();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return state.items.filter((i) => !s || i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s));
  }, [state.items, q]);

  return (
    <>
      <Card>
        <CardHeader title="Imported catalogues" description="Each file's extraction warnings stay attached for audit." />
        <ul className="divide-y divide-slate-100">
          {state.catalogues.map((c) => (
            <li key={c.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-navy-900">{supplier(c.supplierId)?.name}</span>
                <span className="font-mono text-[12px] text-slate-500">{c.file}</span>
                <span className="text-[12px] text-slate-500">{c.itemCount} items</span>
                {c.demo && <Badge tone="amber">Fictional sample</Badge>}
                <span className="flex-1" />
                {c.issues.length > 0 && (
                  <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="text-[12px] font-medium text-est-700 hover:underline">
                    {c.issues.length} warning(s)
                  </button>
                )}
                <span className="text-[12px] text-slate-400">{new Date(c.importedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
              {open === c.id && (
                <ul className="mt-2 space-y-0.5 text-[12px] text-est-700">
                  {c.issues.map((i, k) => (
                    <li key={k}>
                      {i.row ? `Row ${i.row}: ` : ""}
                      {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="All catalogue items"
          description={`${state.items.length} items`}
          action={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU" aria-label="Search items" className="h-8 w-56 rounded-md border border-slate-300 px-2.5 text-[13px]" />}
        />
        <ItemTable items={filtered} />
      </Card>
    </>
  );
}
