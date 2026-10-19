import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  compare,
  extractCatalogue,
  findMatches,
  findMissingInfo,
  parsePackSize,
  recommend,
  DEFAULT_TARGETS,
  type CatalogueItem,
  type ProductGroup,
  type Supplier,
} from "./index";

const DIR = path.join(__dirname, "../../../public/demo-catalogues");
const terms = JSON.parse(readFileSync(path.join(DIR, "supplier-terms.json"), "utf8"));

function loadAll() {
  const suppliers: Supplier[] = [];
  const items: CatalogueItem[] = [];
  for (const s of terms.suppliers) {
    suppliers.push({ id: s.id, name: s.name, kind: s.kind, terms: { ...s.terms, planningLeadTimeDays: 2, source: null } });
    const res = extractCatalogue(readFileSync(path.join(DIR, s.catalogue), "utf8"), {
      supplierId: s.id,
      file: s.catalogue,
      priceBasis: s.catalogueOptions?.priceBasis,
    });
    items.push(...res.items);
  }
  return { suppliers, items };
}

describe("parsePackSize", () => {
  it.each([
    ["24x330ml", 24, 330, "ml"],
    ["12 x 1L", 12, 1000, "ml"],
    ["6 x 4 x 330ml", 24, 330, "ml"],
    ["330ml x 24", 24, 330, "ml"],
    ["1x5kg", 1, 5000, "g"],
    ["Case of 12 rolls", 12, 1, "each"],
    ["12 rolls", 12, 1, "each"],
    ["24 X 33cl", 24, 330, "ml"],
  ])("%s", (raw, units, size, base) => {
    const p = parsePackSize(raw)!;
    expect(p.unitsPerCase).toBe(units);
    expect(p.unitSize).toBe(size);
    expect(p.baseUnit).toBe(base);
  });

  it("returns null for unparseable text", () => {
    expect(parsePackSize("assorted")).toBeNull();
    expect(parsePackSize("")).toBeNull();
  });
});

describe("extractCatalogue", () => {
  it("derives case price from unit price and records basis", () => {
    const { items } = loadAll();
    const water = items.find((i) => i.id === "harbor:HV-20110")!;
    expect(water.casePriceBasis).toBe("derived_from_unit");
    expect(water.casePrice).toBeCloseTo(6.24);
  });

  it("reads tier price columns", () => {
    const { items } = loadAll();
    expect(items.find((i) => i.id === "northgate:NP-1001")!.tiers).toEqual([{ minCases: 5, casePrice: 10.8 }]);
  });

  it("requires a price basis for an unqualified price column", () => {
    const text = readFileSync(path.join(DIR, "meridian-cash-carry.csv"), "utf8");
    const res = extractCatalogue(text, { supplierId: "meridian", file: "m.csv" });
    expect(res.needsPriceBasis).toBe(true);
    expect(res.items.every((i) => i.casePrice === null)).toBe(true);
  });

  it("does not invent missing prices or pack sizes", () => {
    const { items } = loadAll();
    expect(items.find((i) => i.id === "fieldstone:FD-GR-500")!.casePrice).toBeNull();
    expect(items.find((i) => i.id === "fieldstone:FD-OT-1K")!.pack).toBeNull();
  });
});

describe("findMatches", () => {
  const { items } = loadAll();
  const matches = findMatches(items);
  const groupWith = (id: string) => matches.find((m) => m.itemIds.includes(id));

  it("groups same products across suppliers with differing case sizes", () => {
    const g = groupWith("northgate:NP-1001")!;
    expect(g.itemIds).toEqual(expect.arrayContaining(["harbor:HV-20110", "meridian:MCC-0451"]));
  });

  it("flags variant differences for review", () => {
    const cola = groupWith("meridian:MCC-0460");
    expect(cola?.status).toBe("needs_review");
    const oat = groupWith("harbor:HV-20420");
    expect(oat?.status ?? "needs_review").toBe("needs_review");
  });

  it("never puts two items from one supplier in a group", () => {
    for (const m of matches) {
      const sup = m.itemIds.map((i) => i.split(":")[0]);
      expect(new Set(sup).size).toBe(sup.length);
    }
  });
});

describe("compare", () => {
  const { suppliers, items } = loadAll();
  const groups: ProductGroup[] = [
    { id: "water", label: "Water", itemIds: ["northgate:NP-1001", "harbor:HV-20110", "meridian:MCC-0451"], baseUnit: "ml" },
    { id: "rice", label: "Rice", itemIds: ["northgate:NP-1005", "harbor:HV-20515", "meridian:MCC-0633"], baseUnit: "g" },
  ];

  it("normalizes to per-litre and per-kg costs", () => {
    const cmp = compare([{ groupId: "water", required: 330 * 48 }, { groupId: "rice", required: 10000 }], groups, items, suppliers);
    expect(cmp.lineMatrix.water.northgate!.unitCost).toBeCloseTo(11.4 / 24 / 0.33, 3);
    expect(cmp.lineMatrix.rice.northgate!.unitCost).toBeCloseTo(9.8 / 5, 3);
    expect(cmp.lineMatrix.rice.northgate!.cases).toBe(2);
  });

  it("applies tier pricing and flags minimum order shortfalls", () => {
    const cmp = compare([{ groupId: "water", required: 330 * 24 * 5 }], groups, items, suppliers);
    const ng = cmp.lineMatrix.water.northgate!;
    expect(ng.tierApplied).toBe(5);
    expect(ng.lineCost).toBeCloseTo(54);
    const ngPlan = cmp.singleSupplier.find((p) => p.orders[0]?.supplierId === "northgate")!;
    expect(ngPlan.valid).toBe(false);
    expect(ngPlan.orders[0].shortfall).toBeCloseTo(196);
  });

  it("chooses a valid plan when one exists", () => {
    const cmp = compare([{ groupId: "water", required: 330 * 24 * 5 }], groups, items, suppliers);
    expect(cmp.best!.valid).toBe(true);
    expect(cmp.best!.orders.map((o) => o.supplierId)).toEqual(["meridian"]);
  });

  it("marks suppliers with unstated terms", () => {
    const missing = findMissingInfo(suppliers, items);
    expect(missing.some((m) => m.supplierId === "fieldstone" && m.field === "deliveryFee")).toBe(true);
  });
});

describe("recommend", () => {
  it("requires enough history", () => {
    const r = recommend({ groupId: "g", onHand: 1, onOrder: 0, dailySales: [1, 2, 3], countedOn: "2026-10-17" }, DEFAULT_TARGETS, 2, 6);
    expect(r.status).toBe("insufficient_data");
  });

  it("rounds to whole cases", () => {
    const r = recommend({ groupId: "g", onHand: 10, onOrder: 0, dailySales: Array(14).fill(5), countedOn: "2026-10-17" }, DEFAULT_TARGETS, 2, 12);
    // order-up-to = 5 * (2 + 3 + 14) = 95 → 85 units → 8 cases of 12
    expect(r.status).toBe("order");
    expect(r.suggestedUnits).toBe(85);
    expect(r.suggestedCases).toBe(8);
  });
});
