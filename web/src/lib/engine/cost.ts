import type { CatalogueItem, ProductGroup, Supplier } from "./types";
import { baseQuantityPerCase, comparisonUnit } from "./units";

/**
 * Total-cost comparison. All figures are calculated only from imported
 * catalogue prices and supplier terms. Where a term is not stated (delivery
 * fee, minimum order), the result is marked incomplete instead of assuming.
 */

export interface BasketLine {
  groupId: string;
  /** Required quantity in base units (ml, g, each). */
  required: number;
}

export interface LineQuote {
  groupId: string;
  itemId: string;
  supplierId: string;
  cases: number;
  casePrice: number;
  tierApplied: number | null;
  lineCost: number;
  /** Base units delivered (≥ required because cases are whole). */
  delivered: number;
  overbuy: number;
  /** Cost per comparison unit (per L / kg / unit) before delivery & discounts. */
  unitCost: number;
}

export interface SupplierOrder {
  supplierId: string;
  lines: LineQuote[];
  subtotal: number;
  discountPercent: number;
  discount: number;
  /** null = delivery fee not stated by supplier. */
  delivery: number | null;
  deliveryWaived: boolean;
  total: number;
  minimumOrderValue: number | null;
  meetsMinimum: boolean | null;
  shortfall: number;
  notes: string[];
}

export interface Plan {
  kind: "single" | "split";
  orders: SupplierOrder[];
  total: number;
  coveredGroups: string[];
  missingGroups: string[];
  complete: boolean;
  valid: boolean;
  issues: string[];
}

export interface Comparison {
  /** Per group, every supplier's line quote (or null when not available/priced). */
  lineMatrix: Record<string, Record<string, LineQuote | null>>;
  singleSupplier: Plan[];
  best: Plan | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function quoteLine(item: CatalogueItem, required: number): LineQuote | null {
  if (!item.pack || item.casePrice == null || required <= 0) return null;
  const perCase = baseQuantityPerCase(item.pack);
  const cases = Math.ceil(required / perCase - 1e-9);
  let casePrice = item.casePrice;
  let tierApplied: number | null = null;
  for (const t of item.tiers) {
    if (cases >= t.minCases && t.casePrice < casePrice) {
      casePrice = t.casePrice;
      tierApplied = t.minCases;
    }
  }
  const lineCost = r2(cases * casePrice);
  const delivered = cases * perCase;
  const cu = comparisonUnit(item.pack.baseUnit);
  return {
    groupId: "",
    itemId: item.id,
    supplierId: item.supplierId,
    cases,
    casePrice,
    tierApplied,
    lineCost,
    delivered,
    overbuy: delivered - required,
    unitCost: (casePrice / perCase) * cu.factor,
  };
}

export function priceOrder(supplier: Supplier, lines: LineQuote[]): SupplierOrder {
  const t = supplier.terms;
  const notes: string[] = [];
  const subtotal = r2(lines.reduce((s, l) => s + l.lineCost, 0));

  const disc = [...t.volumeDiscounts].sort((a, b) => b.minSubtotal - a.minSubtotal).find((d) => subtotal >= d.minSubtotal);
  const discountPercent = disc?.percent ?? 0;
  const discount = r2((subtotal * discountPercent) / 100);
  if (disc) notes.push(`${disc.percent}% volume discount applied (goods subtotal ≥ ${disc.minSubtotal})`);

  let delivery: number | null = t.deliveryFee;
  let deliveryWaived = false;
  if (t.freeDeliveryThreshold != null && subtotal >= t.freeDeliveryThreshold) {
    delivery = 0;
    deliveryWaived = true;
    notes.push(`Delivery waived (goods subtotal ≥ ${t.freeDeliveryThreshold})`);
  } else if (delivery == null) {
    notes.push("Delivery charge not stated by supplier — total excludes delivery");
  }

  let meetsMinimum: boolean | null = null;
  let shortfall = 0;
  if (t.minimumOrderValue != null) {
    meetsMinimum = subtotal >= t.minimumOrderValue;
    if (!meetsMinimum) {
      shortfall = r2(t.minimumOrderValue - subtotal);
      notes.push(`Below minimum order value by ${shortfall}`);
    }
  } else {
    notes.push("Minimum order value not stated by supplier");
  }

  return {
    supplierId: supplier.id,
    lines,
    subtotal,
    discountPercent,
    discount,
    delivery,
    deliveryWaived,
    total: r2(subtotal - discount + (delivery ?? 0)),
    minimumOrderValue: t.minimumOrderValue,
    meetsMinimum,
    shortfall,
    notes,
  };
}

function buildPlan(kind: Plan["kind"], orders: SupplierOrder[], suppliers: Map<string, Supplier>, allGroups: string[]): Plan {
  const covered = new Set(orders.flatMap((o) => o.lines.map((l) => l.groupId)));
  const missingGroups = allGroups.filter((g) => !covered.has(g));
  const issues: string[] = [];
  let valid = true;
  let complete = missingGroups.length === 0;
  for (const o of orders) {
    const name = suppliers.get(o.supplierId)?.name ?? o.supplierId;
    if (o.meetsMinimum === false) {
      valid = false;
      issues.push(`${name}: below minimum order value by ${o.shortfall.toFixed(2)}`);
    }
    if (o.delivery == null) {
      complete = false;
      issues.push(`${name}: delivery charge not stated`);
    }
    if (o.minimumOrderValue == null) {
      complete = false;
      issues.push(`${name}: minimum order value not stated`);
    }
  }
  if (missingGroups.length) issues.push(`${missingGroups.length} item(s) not available or not priced`);
  return {
    kind,
    orders,
    total: r2(orders.reduce((s, o) => s + o.total, 0)),
    coveredGroups: [...covered],
    missingGroups,
    complete,
    valid,
    issues,
  };
}

export function compare(
  basket: BasketLine[],
  groups: ProductGroup[],
  items: CatalogueItem[],
  supplierList: Supplier[],
): Comparison {
  const suppliers = new Map(supplierList.map((s) => [s.id, s]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const lines = basket.filter((b) => b.required > 0 && groupById.has(b.groupId));
  const groupIds = lines.map((l) => l.groupId);

  const lineMatrix: Comparison["lineMatrix"] = {};
  for (const line of lines) {
    const row: Record<string, LineQuote | null> = {};
    for (const s of supplierList) row[s.id] = null;
    for (const itemId of groupById.get(line.groupId)!.itemIds) {
      const item = itemById.get(itemId);
      if (!item || !suppliers.has(item.supplierId)) continue;
      const q = quoteLine(item, line.required);
      if (q) row[item.supplierId] = { ...q, groupId: line.groupId };
    }
    lineMatrix[line.groupId] = row;
  }

  const singleSupplier = supplierList.map((s) => {
    const ls = groupIds.map((g) => lineMatrix[g][s.id]).filter((q): q is LineQuote => !!q);
    return buildPlan("single", ls.length ? [priceOrder(s, ls)] : [], suppliers, groupIds);
  });

  const best = optimise(groupIds, lineMatrix, supplierList, suppliers);
  return { lineMatrix, singleSupplier, best };
}

function rank(p: Plan): number[] {
  // Prefer: valid, then covers most, then complete terms, then cheapest.
  return [p.valid ? 0 : 1, p.missingGroups.length, p.complete ? 0 : 1, p.total];
}

function better(a: Plan, b: Plan | null): boolean {
  if (!b) return true;
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i];
  return a.orders.length < b.orders.length;
}

function planFromAssignment(
  assign: Map<string, string>,
  lineMatrix: Comparison["lineMatrix"],
  suppliers: Map<string, Supplier>,
  groupIds: string[],
): Plan {
  const bySupplier = new Map<string, LineQuote[]>();
  for (const [g, s] of assign) {
    const q = lineMatrix[g][s];
    if (!q) continue;
    bySupplier.set(s, [...(bySupplier.get(s) ?? []), q]);
  }
  const orders = [...bySupplier].map(([s, ls]) => priceOrder(suppliers.get(s)!, ls));
  return buildPlan(orders.length > 1 ? "split" : "single", orders, suppliers, groupIds);
}

/**
 * Search supplier subsets, assign each line to the cheapest supplier in the
 * subset, then improve by moving single lines (captures free-delivery and
 * discount thresholds). This is a heuristic: the result is labelled as the
 * best plan found, not a guaranteed optimum.
 */
function optimise(
  groupIds: string[],
  lineMatrix: Comparison["lineMatrix"],
  supplierList: Supplier[],
  suppliers: Map<string, Supplier>,
): Plan | null {
  if (!groupIds.length) return null;
  const ids = supplierList.map((s) => s.id);
  let best: Plan | null = null;
  const n = ids.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset = ids.filter((_, i) => mask & (1 << i));
    const assign = new Map<string, string>();
    for (const g of groupIds) {
      let pick: string | null = null;
      for (const s of subset) {
        const q = lineMatrix[g][s];
        if (q && (pick == null || q.lineCost < lineMatrix[g][pick]!.lineCost)) pick = s;
      }
      if (pick) assign.set(g, pick);
    }
    let plan = planFromAssignment(assign, lineMatrix, suppliers, groupIds);
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 50) {
      improved = false;
      for (const g of groupIds) {
        for (const s of subset) {
          if (assign.get(g) === s || !lineMatrix[g][s]) continue;
          const trial = new Map(assign);
          trial.set(g, s);
          const tp = planFromAssignment(trial, lineMatrix, suppliers, groupIds);
          if (better(tp, plan)) {
            plan = tp;
            assign.set(g, s);
            improved = true;
          }
        }
      }
    }
    if (better(plan, best)) best = plan;
  }
  return best;
}

/** Spread delivery and discounts over lines by value to get landed unit cost. */
export function landedUnitCost(order: SupplierOrder, line: LineQuote): number {
  if (!order.subtotal) return line.unitCost;
  const share = line.lineCost / order.subtotal;
  const landedLine = line.lineCost - order.discount * share + (order.delivery ?? 0) * share;
  return (landedLine / line.lineCost) * line.unitCost;
}
