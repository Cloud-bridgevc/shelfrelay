import "server-only";
import { findMatches, DEFAULT_TARGETS } from "@/lib/engine";
import type { WorkspaceState } from "@/lib/workspace";
import { loadDemoDataset } from "./load";
import { demoStockRecords } from "./store";

/** Demo basket in sellable units of the anchor item; converted to base units below. */
const DEMO_BASKET: [itemId: string, units: number][] = [
  ["northgate:NP-1001", 192], // sparkling water cans
  ["northgate:NP-1003", 36], // orange juice 1L
  ["northgate:NP-1011", 96], // chopped tomatoes
  ["northgate:NP-1010", 6], // espresso beans 1kg
  ["northgate:NP-1012", 24], // dish soap
  ["northgate:NP-1013", 24], // kitchen towel rolls
];

export async function buildInitialWorkspace(): Promise<WorkspaceState> {
  const data = await loadDemoDataset();
  const matches = findMatches(data.items);
  const basket: Record<string, number> = {};
  for (const [itemId, units] of DEMO_BASKET) {
    const m = matches.find((x) => x.itemIds.includes(itemId) && x.status === "proposed");
    const item = data.items.find((i) => i.id === itemId);
    if (m && item?.pack) basket[m.id] = units * item.pack.unitSize;
  }
  const stock = demoStockRecords();
  return {
    version: 1,
    suppliers: data.suppliers,
    items: data.items,
    catalogues: data.catalogues.map((c, i) => ({
      id: `demo-${i}`,
      supplierId: c.supplierId,
      file: c.file,
      importedAt: "2026-10-17T09:00:00.000Z",
      method: "csv",
      itemCount: c.itemCount,
      issues: c.issues,
      demo: true,
    })),
    matches,
    basket,
    stock,
    targets: DEFAULT_TARGETS,
    replenishSource: Object.fromEntries(stock.map((s) => [s.itemId, s.itemId])),
    orders: [
      {
        id: "PO-2026-0998",
        supplierId: "harbor",
        lines: [{ itemId: "harbor:HV-20420", cases: 1, casePrice: data.items.find((i) => i.id === "harbor:HV-20420")?.casePrice ?? 0 }],
        status: "acknowledged",
        createdAt: "2026-10-15T14:10:00.000Z",
        supplierRef: "HV-ACK-0001 (demo)",
        notes: "Demo record. Delivery date not yet confirmed by supplier.",
        history: [
          { status: "draft", at: "2026-10-15T14:10:00.000Z" },
          { status: "sent", at: "2026-10-15T14:22:00.000Z", note: "Emailed to supplier" },
          { status: "acknowledged", at: "2026-10-16T08:05:00.000Z", note: "Supplier acknowledged by email" },
        ],
      },
    ],
  };
}
