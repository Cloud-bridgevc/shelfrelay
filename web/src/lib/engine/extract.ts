import type { CatalogueItem, PriceTier } from "./types";
import { parsePackSize } from "./units";

/**
 * Structured extraction for tabular supplier catalogues (CSV / TSV, or the
 * table output Textract produces from PDFs). Only values present in the file
 * are imported; anything ambiguous is reported as an issue, never filled in.
 */

export type Field =
  | "sku"
  | "name"
  | "brand"
  | "category"
  | "pack"
  | "casePrice"
  | "unitPrice"
  | "price"
  | "availability";

const SYNONYMS: Record<Field, string[]> = {
  sku: ["sku", "item code", "product code", "code", "item no", "item number", "article", "article no", "ref"],
  name: ["description", "product", "product name", "item", "item description", "name", "product description"],
  brand: ["brand", "manufacturer", "make"],
  category: ["category", "department", "dept", "range"],
  pack: ["pack", "pack size", "case size", "size", "format", "packaging", "case format", "pack format"],
  casePrice: ["case price", "price per case", "cost per case", "case cost", "price case", "outer price", "trade price case"],
  unitPrice: ["unit price", "price per unit", "each price", "price each", "unit cost", "cost each"],
  price: ["price", "cost", "list price", "trade price", "net price"],
  availability: ["availability", "stock", "status", "stock status"],
};

export interface ExtractIssue {
  row?: number;
  severity: "error" | "warning";
  message: string;
}

export interface ColumnMapping {
  field: Field | "tier" | null;
  header: string;
  tierMinCases?: number;
}

export interface ExtractResult {
  items: CatalogueItem[];
  mapping: ColumnMapping[];
  issues: ExtractIssue[];
  /** True when a plain "price" column exists and its basis must be chosen by the user. */
  needsPriceBasis: boolean;
}

export interface ExtractOptions {
  supplierId: string;
  file: string;
  method?: "csv" | "textract";
  /** Required to import a column simply labelled "price". */
  priceBasis?: "case" | "unit";
}

export function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
    ? "\t"
    : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[_\-/().$£€#:]+/g, " ").replace(/\s+/g, " ").trim();
}

export function mapColumns(headers: string[]): ColumnMapping[] {
  const used = new Set<Field>();
  return headers.map((header) => {
    const h = normHeader(header);
    const tier = h.match(/(\d+)\s*\+?\s*(?:cases?|cs)?\b.*price|price.*?(\d+)\s*\+/);
    if (tier && /\+|cases?/.test(h)) {
      const n = parseInt(tier[1] ?? tier[2], 10);
      if (n > 1) return { field: "tier" as const, header, tierMinCases: n };
    }
    // Most specific fields first so "case price" isn't captured by "price".
    const order: Field[] = ["casePrice", "unitPrice", "sku", "brand", "category", "availability", "pack", "name", "price"];
    for (const field of order) {
      if (used.has(field)) continue;
      if (SYNONYMS[field].includes(h)) {
        used.add(field);
        return { field, header };
      }
    }
    return { field: null, header };
  });
}

export function parseMoney(value: string | undefined): number | null {
  if (value == null) return null;
  const v = value.replace(/[£$€,\s]/g, "");
  if (!v || /^(n\/?a|tbc|poa|-+|—)$/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function extractCatalogue(text: string, opts: ExtractOptions): ExtractResult {
  const rows = parseDelimited(text);
  const issues: ExtractIssue[] = [];
  if (rows.length < 2) {
    return { items: [], mapping: [], issues: [{ severity: "error", message: "No data rows found." }], needsPriceBasis: false };
  }
  const [headers, ...data] = rows;
  const mapping = mapColumns(headers);
  const col = (f: Field) => mapping.findIndex((m) => m.field === f);

  const idx = {
    sku: col("sku"),
    name: col("name"),
    brand: col("brand"),
    category: col("category"),
    pack: col("pack"),
    casePrice: col("casePrice"),
    unitPrice: col("unitPrice"),
    price: col("price"),
    availability: col("availability"),
  };
  const tierCols = mapping
    .map((m, i) => ({ ...m, i }))
    .filter((m) => m.field === "tier");

  if (idx.name < 0) issues.push({ severity: "error", message: "No product description column recognised." });
  if (idx.pack < 0) issues.push({ severity: "warning", message: "No pack size column recognised; pack sizes will be read from descriptions where stated." });

  const plainPriceOnly = idx.casePrice < 0 && idx.unitPrice < 0 && idx.price >= 0;
  const needsPriceBasis = plainPriceOnly && !opts.priceBasis;
  if (needsPriceBasis) {
    issues.push({
      severity: "warning",
      message: `Column "${headers[idx.price]}" does not say whether it is per case or per unit. Choose a price basis to import prices.`,
    });
  }
  if (idx.casePrice < 0 && idx.unitPrice < 0 && idx.price < 0) {
    issues.push({ severity: "error", message: "No price column recognised." });
  }

  const unmapped = mapping.filter((m) => m.field === null).map((m) => m.header);
  if (unmapped.length) {
    issues.push({ severity: "warning", message: `Ignored columns: ${unmapped.join(", ")}` });
  }

  const items: CatalogueItem[] = [];
  data.forEach((cells, i) => {
    const rowNo = i + 1;
    const get = (j: number) => (j >= 0 ? cells[j] ?? "" : "");
    const name = get(idx.name);
    if (!name) {
      issues.push({ row: rowNo, severity: "warning", message: "Row skipped: no product description." });
      return;
    }
    const raw: Record<string, string> = {};
    headers.forEach((h, j) => (raw[h] = cells[j] ?? ""));

    const packText = get(idx.pack);
    // A size in the description ("Rolled Oats 1kg") says nothing about how many
    // units are in a case, so only fall back to it when it states a multiplier.
    const pack = packText ? parsePackSize(packText) : /\d\s*x\s*\d/i.test(name) ? parsePackSize(name) : null;
    if (!pack) {
      issues.push({ row: rowNo, severity: "warning", message: `"${name}": pack size not stated or not recognised${packText ? ` ("${packText}")` : ""}.` });
    }

    let casePrice: number | null = null;
    let basis: CatalogueItem["casePriceBasis"] = "missing";
    const stated = idx.casePrice >= 0 ? parseMoney(get(idx.casePrice)) : plainPriceOnly && opts.priceBasis === "case" ? parseMoney(get(idx.price)) : null;
    const unit = idx.unitPrice >= 0 ? parseMoney(get(idx.unitPrice)) : plainPriceOnly && opts.priceBasis === "unit" ? parseMoney(get(idx.price)) : null;
    if (stated != null) {
      casePrice = stated;
      basis = "stated_case";
    } else if (unit != null && pack) {
      casePrice = round2(unit * pack.unitsPerCase);
      basis = "derived_from_unit";
    } else if (unit != null && !pack) {
      issues.push({ row: rowNo, severity: "warning", message: `"${name}": unit price stated but case price cannot be derived without a pack size.` });
    }
    if (casePrice == null && !needsPriceBasis) {
      issues.push({ row: rowNo, severity: "warning", message: `"${name}": no price stated.` });
    }

    const tiers: PriceTier[] = [];
    for (const t of tierCols) {
      const p = parseMoney(cells[t.i]);
      if (p != null && t.tierMinCases) tiers.push({ minCases: t.tierMinCases, casePrice: p });
    }
    tiers.sort((a, b) => a.minCases - b.minCases);

    const sku = get(idx.sku) || `ROW-${rowNo}`;
    if (!get(idx.sku)) issues.push({ row: rowNo, severity: "warning", message: `"${name}": no SKU stated.` });

    items.push({
      id: `${opts.supplierId}:${sku}`,
      supplierId: opts.supplierId,
      sku,
      name,
      brand: get(idx.brand) || undefined,
      category: get(idx.category) || undefined,
      pack,
      casePrice,
      casePriceBasis: basis,
      tiers,
      statedAvailability: get(idx.availability) || undefined,
      source: { file: opts.file, row: rowNo, method: opts.method ?? "csv" },
      raw,
    });
  });

  return { items, mapping, issues, needsPriceBasis };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
