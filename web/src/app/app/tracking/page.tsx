"use client";

import { useState } from "react";
import { useWorkspace, type OrderStatus, type PurchaseOrder } from "@/lib/workspace";
import { priceDraft, STATUS_FLOW, STATUS_LABEL } from "@/lib/orders";
import { cn, money } from "@/lib/format";
import { Badge, buttonClass, Card, EmptyState, PageHeader, ProvenanceBadge } from "@/components/ui";

const TONE: Record<OrderStatus, "neutral" | "navy" | "green" | "amber" | "red"> = {
  draft: "neutral",
  ready: "neutral",
  sent: "navy",
  acknowledged: "navy",
  partially_received: "amber",
  received: "green",
  cancelled: "red",
};

export default function TrackingPage() {
  const { state } = useWorkspace();
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const orders = state.orders.filter((o) => !["draft", "ready"].includes(o.status));
  const shown = orders.filter((o) => (filter === "open" ? !["received", "cancelled"].includes(o.status) : ["received", "cancelled"].includes(o.status)));

  return (
    <>
      <PageHeader
        eyebrow="Order status tracking"
        title="Order tracking"
        description="Statuses, supplier references and delivery dates are recorded by your team as suppliers confirm them. ShelfRelay never estimates a delivery date."
      />
      <div className="mb-5 inline-flex rounded-lg bg-slate-100 p-1 text-[13px]">
        {(["open", "closed"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1.5 font-medium capitalize", filter === f ? "bg-white text-navy-900 shadow-sm" : "text-slate-500")}>
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title={filter === "open" ? "No orders in progress" : "No closed orders"}>Orders appear here once marked as sent.</EmptyState>
      ) : (
        <div className="space-y-5">
          {shown.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </>
  );
}

function OrderCard({ order }: { order: PurchaseOrder }) {
  const { supplier, item, setOrderStatus, patchOrder } = useWorkspace();
  const sup = supplier(order.supplierId);
  const { priced } = priceDraft(order, sup, item);
  const idx = STATUS_FLOW.indexOf(order.status);
  const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  const steps = STATUS_FLOW.slice(2);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy-900">
            {order.id} · {sup?.name}
          </p>
          <p className="text-[12px] text-slate-500">
            {order.lines.length} line(s) · {priced ? money(priced.total) : "—"} calculated total
          </p>
        </div>
        <Badge tone={TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
      </div>

      <div className="grid gap-6 px-5 py-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <ol className="flex items-center gap-1" aria-label="Order progress">
            {steps.map((s) => {
              const reached = order.status !== "cancelled" && STATUS_FLOW.indexOf(order.status) >= STATUS_FLOW.indexOf(s);
              return (
                <li key={s} className="flex flex-1 flex-col gap-1.5">
                  <span className={cn("h-1.5 rounded-full", reached ? "bg-accent-500" : "bg-slate-200")} />
                  <span className={cn("text-[11px]", reached ? "font-medium text-navy-900" : "text-slate-400")}>{STATUS_LABEL[s]}</span>
                </li>
              );
            })}
          </ol>
          <ul className="mt-5 space-y-2 border-l border-slate-200 pl-4 text-[12.5px]">
            {[...order.history].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-navy-600" aria-hidden />
                <span className="font-medium text-navy-900">{STATUS_LABEL[h.status]}</span>
                <span className="text-slate-500"> · {new Date(h.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                {h.note && <span className="block text-slate-500">{h.note}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <label className="block text-[13px] font-medium text-navy-900">
            Supplier reference
            <input
              defaultValue={order.supplierRef ?? ""}
              onBlur={(e) => patchOrder(order.id, { supplierRef: e.target.value.trim() || undefined })}
              placeholder="From the supplier's acknowledgement"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
            />
          </label>
          <label className="block text-[13px] font-medium text-navy-900">
            <span className="flex items-center gap-2">
              Delivery date confirmed by supplier <ProvenanceBadge kind="user" />
            </span>
            <input
              type="date"
              defaultValue={order.confirmedDeliveryDate ?? ""}
              onChange={(e) => patchOrder(order.id, { confirmedDeliveryDate: e.target.value || undefined })}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm"
            />
            {!order.confirmedDeliveryDate && <span className="mt-1 block text-[11px] font-normal text-slate-500">Not yet confirmed. Stated lead time: {sup?.terms.statedLeadTime ?? "not stated"}.</span>}
          </label>
          {order.notes && <p className="rounded-md bg-slate-50 px-3 py-2 text-[12px] text-slate-600">{order.notes}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {next && order.status !== "cancelled" && (
              <button type="button" onClick={() => setOrderStatus(order.id, next)} className={buttonClass("primary", "sm")}>
                Mark {STATUS_LABEL[next].toLowerCase()}
              </button>
            )}
            {!["received", "cancelled"].includes(order.status) && (
              <button type="button" onClick={() => setOrderStatus(order.id, "cancelled", "Cancelled by user")} className={buttonClass("ghost", "sm", "text-red-700")}>
                Cancel order
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
