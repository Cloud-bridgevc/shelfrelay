/**
 * FICTIONAL demo store: "Larkspur Market", an independent grocer.
 * Stock counts and sales history are generated deterministically so the demo
 * is reproducible. They stand in for records a retailer would import from
 * their POS / inventory system.
 */

export const DEMO_STORE = { name: "Larkspur Market", note: "Fictional independent grocer used for the demo" };

/** Planning lead times (days) as a user would configure them per supplier. */
export const DEMO_PLANNING_LEAD_TIMES: Record<string, number | null> = {
  northgate: 1,
  harbor: 3,
  meridian: 2,
  fieldstone: null,
};

export interface DemoStockRow {
  /** Catalogue item the store currently stocks this product as. */
  itemId: string;
  onHand: number;
  onOrder: number;
  meanDaily: number;
  historyDays: number;
}

const ROWS: DemoStockRow[] = [
  { itemId: "northgate:NP-1001", onHand: 40, onOrder: 0, meanDaily: 18, historyDays: 28 },
  { itemId: "northgate:NP-1002", onHand: 130, onOrder: 0, meanDaily: 12, historyDays: 28 },
  { itemId: "northgate:NP-1003", onHand: 9, onOrder: 0, meanDaily: 4, historyDays: 28 },
  { itemId: "harbor:HV-20420", onHand: 14, onOrder: 6, meanDaily: 3, historyDays: 28 },
  { itemId: "harbor:HV-20515", onHand: 6, onOrder: 0, meanDaily: 1.5, historyDays: 28 },
  { itemId: "northgate:NP-1006", onHand: 22, onOrder: 0, meanDaily: 5, historyDays: 28 },
  { itemId: "northgate:NP-1007", onHand: 11, onOrder: 0, meanDaily: 1.2, historyDays: 28 },
  { itemId: "northgate:NP-1008", onHand: 30, onOrder: 0, meanDaily: 6, historyDays: 28 },
  { itemId: "northgate:NP-1009", onHand: 7, onOrder: 0, meanDaily: 1, historyDays: 28 },
  { itemId: "northgate:NP-1010", onHand: 4, onOrder: 0, meanDaily: 0.8, historyDays: 28 },
  { itemId: "northgate:NP-1011", onHand: 48, onOrder: 0, meanDaily: 7, historyDays: 28 },
  { itemId: "meridian:MCC-1020", onHand: 15, onOrder: 0, meanDaily: 1, historyDays: 28 },
  { itemId: "northgate:NP-1013", onHand: 20, onOrder: 0, meanDaily: 1.5, historyDays: 28 },
  { itemId: "fieldstone:FD-PB-340S", onHand: 5, onOrder: 0, meanDaily: 0.9, historyDays: 9 },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoStockRecord {
  itemId: string;
  onHand: number;
  onOrder: number;
  dailySales: number[];
  countedOn: string;
}

export function demoStockRecords(countedOn = "2026-10-17"): DemoStockRecord[] {
  return ROWS.map((r, idx) => {
    const rand = mulberry32(1000 + idx * 97);
    const sales: number[] = [];
    for (let d = 0; d < r.historyDays; d++) {
      const weekend = d % 7 >= 5 ? 1.35 : 1;
      const noise = 0.6 + rand() * 0.8;
      sales.push(Math.max(0, Math.round(r.meanDaily * weekend * noise)));
    }
    return { itemId: r.itemId, onHand: r.onHand, onOrder: r.onOrder, dailySales: sales, countedOn };
  });
}
