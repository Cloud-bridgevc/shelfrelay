import { priceOrder, quoteLine, type CatalogueItem, type LineQuote, type Supplier, type SupplierOrder } from "@/lib/engine";
import type { OrderStatus, PurchaseOrder } from "@/lib/workspace";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Draft",
  ready: "Ready to send",
  sent: "Sent",
  acknowledged: "Acknowledged",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
};

export const STATUS_FLOW: OrderStatus[] = ["draft", "ready", "sent", "acknowledged", "partially_received", "received"];

/** Price a purchase order against the current catalogue and supplier terms. */
export function priceDraft(
  order: PurchaseOrder,
  supplier: Supplier | undefined,
  item: (id: string) => CatalogueItem | undefined,
): { priced: SupplierOrder | null; quotes: (LineQuote | null)[] } {
  const quotes = order.lines.map((l) => {
    const it = item(l.itemId);
    if (!it?.pack || l.cases <= 0) return null;
    return quoteLine(it, l.cases * it.pack.unitsPerCase * it.pack.unitSize);
  });
  if (!supplier) return { priced: null, quotes };
  return { priced: priceOrder(supplier, quotes.filter((q): q is LineQuote => !!q)), quotes };
}

export function orderCsv(order: PurchaseOrder, supplier: Supplier | undefined, item: (id: string) => CatalogueItem | undefined): string {
  const { quotes, priced } = priceDraft(order, supplier, item);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["PO number", order.id],
    ["Supplier", supplier?.name ?? order.supplierId],
    [],
    ["SKU", "Description", "Pack", "Cases", "Case price", "Line total"],
    ...order.lines.map((l, i) => {
      const it = item(l.itemId);
      const q = quotes[i];
      return [it?.sku ?? l.itemId, it?.name ?? "", it?.pack?.raw ?? "", l.cases, q?.casePrice.toFixed(2) ?? "", q?.lineCost.toFixed(2) ?? ""];
    }),
    [],
    ["Goods subtotal", priced?.subtotal.toFixed(2) ?? ""],
    ["Discount", priced?.discount.toFixed(2) ?? ""],
    ["Delivery", priced?.delivery == null ? "Not stated by supplier" : priced.delivery.toFixed(2)],
    ["Total (excl. tax)", priced?.total.toFixed(2) ?? ""],
  ];
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}
