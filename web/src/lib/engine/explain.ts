import type { CatalogueItem, ProductGroup, Supplier } from "./types";
import type { Comparison, Plan } from "./cost";
import { comparisonUnit, describePack } from "./units";

/**
 * Deterministic (rule-based) explanations. These are always available and
 * are what the Bedrock assistant is grounded on in the cloud deployment.
 */

export interface MissingInfo {
  severity: "blocking" | "warning";
  supplierId: string;
  itemId?: string;
  field: string;
  message: string;
}

export function findMissingInfo(suppliers: Supplier[], items: CatalogueItem[]): MissingInfo[] {
  const out: MissingInfo[] = [];
  for (const s of suppliers) {
    const t = s.terms;
    if (t.deliveryFee == null && t.freeDeliveryThreshold == null)
      out.push({ severity: "blocking", supplierId: s.id, field: "deliveryFee", message: `${s.name}: delivery charge not stated. Totals exclude delivery until confirmed.` });
    if (t.minimumOrderValue == null)
      out.push({ severity: "warning", supplierId: s.id, field: "minimumOrderValue", message: `${s.name}: minimum order value not stated.` });
    if (!t.statedLeadTime)
      out.push({ severity: "warning", supplierId: s.id, field: "statedLeadTime", message: `${s.name}: lead time not stated in catalogue or terms.` });
    if (t.planningLeadTimeDays == null)
      out.push({ severity: "warning", supplierId: s.id, field: "planningLeadTimeDays", message: `${s.name}: no planning lead time set; replenishment can't be calculated for this supplier.` });
  }
  for (const it of items) {
    const s = suppliers.find((x) => x.id === it.supplierId);
    const who = `${s?.name ?? it.supplierId} · ${it.name}`;
    if (it.casePrice == null) out.push({ severity: "blocking", supplierId: it.supplierId, itemId: it.id, field: "price", message: `${who}: no price stated.` });
    if (!it.pack) out.push({ severity: "blocking", supplierId: it.supplierId, itemId: it.id, field: "pack", message: `${who}: pack size not stated or not recognised.` });
  }
  return out;
}

const money = (n: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(n);

export function explainComparison(
  cmp: Comparison,
  groups: ProductGroup[],
  suppliers: Supplier[],
  items: CatalogueItem[],
): string[] {
  const out: string[] = [];
  const sName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;
  const item = (id: string) => items.find((i) => i.id === id);
  const best = cmp.best;
  if (!best) return ["Add quantities to the basket to compare suppliers."];

  out.push(describePlan(best, sName));

  const singles = cmp.singleSupplier
    .filter((p) => p.orders.length && p.missingGroups.length === 0)
    .sort((a, b) => a.total - b.total);
  const cheapestSingle = singles.find((p) => p.valid);
  if (cheapestSingle && best.kind === "split") {
    const diff = cheapestSingle.total - best.total;
    out.push(
      diff > 0
        ? `Splitting saves ${money(diff)} versus ordering everything from ${sName(cheapestSingle.orders[0].supplierId)} (${money(cheapestSingle.total)}), at the cost of ${best.orders.length} deliveries to receive.`
        : `Ordering everything from ${sName(cheapestSingle.orders[0].supplierId)} costs the same or less (${money(cheapestSingle.total)}) with a single delivery.`,
    );
  }

  for (const [gid, row] of Object.entries(cmp.lineMatrix)) {
    const g = groups.find((x) => x.id === gid);
    const quotes = Object.values(row).filter(Boolean) as NonNullable<(typeof row)[string]>[];
    if (quotes.length < 2) {
      if (quotes.length === 1) out.push(`${g?.label}: only ${sName(quotes[0].supplierId)} has a priced, comparable item.`);
      continue;
    }
    quotes.sort((a, b) => a.unitCost - b.unitCost);
    const lo = quotes[0];
    const hi = quotes[quotes.length - 1];
    const cu = comparisonUnit(item(lo.itemId)?.pack?.baseUnit ?? "each").label;
    const packs = quotes.map((q) => `${sName(q.supplierId)} ${describePack(item(q.itemId)!.pack!)}`).join(", ");
    let line = `${g?.label}: lowest normalized price is ${sName(lo.supplierId)} at ${money(lo.unitCost)}/${cu} vs ${money(hi.unitCost)}/${cu} at ${sName(hi.supplierId)} (packs: ${packs}).`;
    if (lo.tierApplied) line += ` Includes ${possessive(sName(lo.supplierId))} ${lo.tierApplied}+ case price.`;
    if (lo.overbuy > 0) line += ` Whole cases mean ${Math.round(lo.overbuy)} extra base units are bought.`;
    out.push(line);
  }

  for (const o of best.orders) for (const n of o.notes) out.push(`${sName(o.supplierId)}: ${n}.`);
  for (const issue of best.issues) out.push(`Check: ${issue}.`);
  out.push("Figures are calculated from imported catalogue prices and stated terms; taxes and unstated charges are not included.");
  return out;
}

const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

function describePlan(p: Plan, sName: (id: string) => string): string {
  const parts = p.orders.map((o) => `${sName(o.supplierId)} (${o.lines.length} line${o.lines.length === 1 ? "" : "s"}, ${money(o.total)})`);
  const status = p.valid ? (p.complete ? "" : " Some supplier terms are not stated, so this total may be incomplete.") : " This plan does not meet every minimum order value.";
  return `Lowest calculated total found: ${money(p.total)} via ${parts.join(" + ")}.${status}`;
}

/** Compact, citation-friendly facts used to ground the Bedrock assistant. */
export function assistantContext(suppliers: Supplier[], items: CatalogueItem[], groups: ProductGroup[], cmp?: Comparison) {
  return {
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, terms: { ...s.terms, source: s.terms.source?.file ?? null } })),
    items: items.map((i) => ({
      id: i.id,
      supplier: i.supplierId,
      sku: i.sku,
      name: i.name,
      pack: i.pack?.raw ?? null,
      casePrice: i.casePrice,
      priceBasis: i.casePriceBasis,
      tiers: i.tiers,
      source: `${i.source.file}#row${i.source.row}`,
    })),
    groups: groups.map((g) => ({ id: g.id, label: g.label, items: g.itemIds })),
    bestPlan: cmp?.best ? { total: cmp.best.total, orders: cmp.best.orders.map((o) => ({ supplier: o.supplierId, total: o.total, notes: o.notes })), issues: cmp.best.issues } : null,
    missing: findMissingInfo(suppliers, items).map((m) => m.message),
  };
}
