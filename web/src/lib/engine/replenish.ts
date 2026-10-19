/**
 * Replenishment recommendations from recorded inventory and sales.
 *
 * Demand is the average of recorded daily sales; nothing is forecast beyond
 * that simple rate, and the output is labelled as an estimate. Lead time
 * comes from the user's planning setting for the supplier, never parsed from
 * a supplier's free-text lead-time statement.
 */

export interface StockRecord {
  groupId: string;
  /** Sellable units currently on hand (recorded count). */
  onHand: number;
  /** Units already on open purchase orders. */
  onOrder: number;
  /** Recorded daily unit sales, oldest first. */
  dailySales: number[];
  /** Date of the last stock count, ISO yyyy-mm-dd. */
  countedOn: string;
}

export interface StockTargets {
  /** Days of safety stock to hold. */
  safetyDays: number;
  /** Days of demand to cover after the order arrives. */
  coverDays: number;
  /** Minimum number of recorded sales days required to recommend. */
  minHistoryDays: number;
}

export const DEFAULT_TARGETS: StockTargets = { safetyDays: 3, coverDays: 14, minHistoryDays: 14 };

export interface Recommendation {
  groupId: string;
  status: "order" | "ok" | "insufficient_data" | "no_lead_time";
  avgDailySales: number | null;
  daysOfCover: number | null;
  reorderPoint: number | null;
  orderUpTo: number | null;
  /** Units to order before rounding to cases. */
  suggestedUnits: number;
  /** Whole cases at the chosen supplier's pack size. */
  suggestedCases: number;
  unitsPerCase: number | null;
  leadTimeDays: number | null;
  explanation: string[];
}

export function recommend(
  record: StockRecord,
  targets: StockTargets,
  leadTimeDays: number | null,
  unitsPerCase: number | null,
): Recommendation {
  const base = {
    groupId: record.groupId,
    suggestedUnits: 0,
    suggestedCases: 0,
    unitsPerCase,
    leadTimeDays,
  };
  const days = record.dailySales.length;
  if (days < targets.minHistoryDays) {
    return {
      ...base,
      status: "insufficient_data",
      avgDailySales: null,
      daysOfCover: null,
      reorderPoint: null,
      orderUpTo: null,
      explanation: [`Only ${days} day(s) of recorded sales; at least ${targets.minHistoryDays} are needed before recommending.`],
    };
  }

  const avg = record.dailySales.reduce((a, b) => a + b, 0) / days;
  const position = record.onHand + record.onOrder;
  const daysOfCover = avg > 0 ? record.onHand / avg : null;
  const explanation = [
    `Average recorded sales: ${avg.toFixed(1)} units/day over ${days} days.`,
    `Stock position: ${record.onHand} on hand + ${record.onOrder} on order = ${position} units.`,
  ];

  if (leadTimeDays == null) {
    return {
      ...base,
      status: "no_lead_time",
      avgDailySales: avg,
      daysOfCover,
      reorderPoint: null,
      orderUpTo: null,
      explanation: [...explanation, "No planning lead time set for the selected supplier. Set one in the supplier directory."],
    };
  }

  const reorderPoint = avg * (leadTimeDays + targets.safetyDays);
  const orderUpTo = avg * (leadTimeDays + targets.safetyDays + targets.coverDays);
  explanation.push(
    `Reorder point = ${avg.toFixed(1)} × (${leadTimeDays}d lead + ${targets.safetyDays}d safety) = ${Math.ceil(reorderPoint)} units.`,
  );

  if (position > reorderPoint) {
    return {
      ...base,
      status: "ok",
      avgDailySales: avg,
      daysOfCover,
      reorderPoint,
      orderUpTo,
      explanation: [...explanation, "Stock position is above the reorder point; no order needed now."],
    };
  }

  const suggestedUnits = Math.max(0, Math.ceil(orderUpTo - position));
  const suggestedCases = unitsPerCase ? Math.ceil(suggestedUnits / unitsPerCase) : 0;
  explanation.push(
    `Order-up-to level = ${avg.toFixed(1)} × (${leadTimeDays} + ${targets.safetyDays} + ${targets.coverDays}d cover) = ${Math.ceil(orderUpTo)} units.`,
    `Suggested: ${suggestedUnits} units${unitsPerCase ? ` → ${suggestedCases} case(s) of ${unitsPerCase}` : " (no pack size to round to cases)"}.`,
  );
  return { ...base, status: "order", avgDailySales: avg, daysOfCover, reorderPoint, orderUpTo, suggestedUnits, suggestedCases, explanation };
}
