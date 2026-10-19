import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractCatalogue, type ExtractIssue, type CatalogueItem, type Supplier } from "@/lib/engine";
import { DEMO_PLANNING_LEAD_TIMES } from "./store";

export interface DemoCatalogue {
  supplierId: string;
  file: string;
  issues: ExtractIssue[];
  itemCount: number;
}

export interface DemoDataset {
  currency: string;
  suppliers: Supplier[];
  items: CatalogueItem[];
  catalogues: DemoCatalogue[];
}

interface TermsFile {
  currency: string;
  suppliers: {
    id: string;
    name: string;
    kind: Supplier["kind"];
    region?: string;
    catalogue: string;
    catalogueOptions?: { priceBasis?: "case" | "unit" };
    terms: Omit<Supplier["terms"], "planningLeadTimeDays" | "source">;
  }[];
}

const DIR = path.join(process.cwd(), "public", "demo-catalogues");

/** Runs the fictional demo catalogues through the same extraction pipeline used for uploads. */
export async function loadDemoDataset(): Promise<DemoDataset> {
  const termsFile = JSON.parse(await readFile(path.join(DIR, "supplier-terms.json"), "utf8")) as TermsFile;
  const suppliers: Supplier[] = [];
  const items: CatalogueItem[] = [];
  const catalogues: DemoCatalogue[] = [];

  for (const s of termsFile.suppliers) {
    suppliers.push({
      id: s.id,
      name: s.name,
      kind: s.kind,
      region: s.region,
      fictional: true,
      terms: {
        ...s.terms,
        planningLeadTimeDays: DEMO_PLANNING_LEAD_TIMES[s.id] ?? null,
        source: { file: "supplier-terms.json", method: "manual" },
      },
    });
    const text = await readFile(path.join(DIR, s.catalogue), "utf8");
    const res = extractCatalogue(text, { supplierId: s.id, file: s.catalogue, priceBasis: s.catalogueOptions?.priceBasis });
    items.push(...res.items);
    catalogues.push({ supplierId: s.id, file: s.catalogue, issues: res.issues, itemCount: res.items.length });
  }
  return { currency: termsFile.currency, suppliers, items, catalogues };
}
