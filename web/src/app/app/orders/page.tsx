"use client";

import Link from "next/link";
import { describePack } from "@/lib/engine";
import { useWorkspace, type PurchaseOrder } from "@/lib/workspace";
import { orderCsv, priceDraft, STATUS_LABEL } from "@/lib/orders";
import { money } from "@/lib/format";
import { Badge, buttonClass, ButtonLink, Card, CardHeader, EmptyState, PageHeader, ProvenanceBadge } from "@/components/ui";

export default function OrdersPage() {
  const { state } = useWorkspace();
  const drafts = state.orders.filter((o) => o.status === "draft" || o.status === "ready");

  return (
    <>
      <PageHeader
        eyebrow="Purchase order preparation"
        title="Purchase orders"
        description="Draft orders per supplier, priced against current catalogue prices and stated terms."
        actions={
          <ButtonLink href="/app/tracking" variant="secondary" size="sm">
            Order tracking →
          </ButtonLink>
        }
      />
      {drafts.length === 0 ? (
        <EmptyState
          title="No draft purchase orders"
          action={
            <div className="flex gap-2">
              <ButtonLink href="/app/replenishment" size="sm">
                From replenishment
              </ButtonLink>
              <ButtonLink href="/app/compare" variant="secondary" size="sm">
                From comparison
              </ButtonLink>
            </div>
          }
        >
          Add lines from replenishment suggestions or a comparison plan.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {drafts.map((o) => (
            <DraftCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </>
  );
}

function DraftCard({ order }: { order: PurchaseOrder }) {
  const { supplier, item, patchOrder, setOrderStatus } = useWorkspace();
  const sup = supplier(order.supplierId);
  const { priced, quotes } = priceDraft(order, sup, item);

  const setCases = (itemId: string, cases: number) =>
    patchOrder(order.id, { lines: order.lines.map((l) => (l.itemId === itemId ? { ...l, cases: Math.max(0, Math.floor(cases)) } : l)).filter((l) => l.cases > 0) });

  const download = () => {
    const blob = new Blob([orderCsv(order, sup, item)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${order.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <CardHeader
        title={`${order.id} · ${sup?.name ?? order.supplierId}`}
        description={`Created ${new Date(order.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
        action={<Badge tone={order.status === "ready" ? "green" : "neutral"}>{STATUS_LABEL[order.status]}</Badge>}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Pack</th>
              <th className="px-3 py-2 text-right font-medium">Cases</th>
              <th className="px-3 py-2 text-right font-medium">Case price</th>
              <th className="px-5 py-2 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l, i) => {
              const it = item(l.itemId);
              const q = quotes[i];
              const changed = q && Math.abs(q.casePrice - l.casePrice) > 0.001;
              return (
                <tr key={l.itemId} className="border-b border-slate-50">
                  <td className="px-5 py-2.5">
                    <p className="text-navy-900">{it?.name ?? l.itemId}</p>
                    <p className="font-mono text-[11px] text-slate-400">{it?.sku}</p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{it?.pack ? describePack(it.pack) : "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <input
                      type="number"
                      min={0}
                      value={l.cases}
                      disabled={order.status !== "draft"}
                      aria-label={`Cases of ${it?.name}`}
                      onChange={(e) => setCases(l.itemId, Number(e.target.value))}
                      className="tabular h-8 w-20 rounded-md border border-slate-300 px-2 text-right disabled:bg-slate-50"
                    />
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {money(q?.casePrice)}
                    {q?.tierApplied && <span className="block text-[11px] text-slate-500">{q.tierApplied}+ case price</span>}
                    {changed && <span className="block text-[11px] text-est-700">was {money(l.casePrice)} when added</span>}
                  </td>
                  <td className="tabular px-5 py-2.5 text-right font-medium">{money(q?.lineCost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {priced && (
        <div className="grid gap-4 border-t border-slate-100 px-5 py-4 md:grid-cols-[1fr_300px]">
          <div className="space-y-1 text-[12.5px]">
            {priced.notes.map((n) => (
              <p key={n} className={/not stated|Below/.test(n) ? "text-est-700" : "text-slate-600"}>
                • {n}
              </p>
            ))}
            {priced.meetsMinimum === false && (
              <p className="text-red-700">
                Add {money(priced.shortfall)} more to meet {sup?.name}&apos;s minimum, or{" "}
                <Link href="/app/compare" className="underline">
                  compare other suppliers
                </Link>
                .
              </p>
            )}
          </div>
          <dl className="tabular space-y-1 text-[13px]">
            <Row label="Goods subtotal" value={money(priced.subtotal)} />
            {priced.discount > 0 && <Row label={`Discount (${priced.discountPercent}%)`} value={`−${money(priced.discount)}`} />}
            <Row label="Delivery" value={priced.delivery == null ? "Not stated" : priced.deliveryWaived ? "Waived" : money(priced.delivery)} />
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-[15px] font-semibold text-navy-900">
              <dt className="flex items-center gap-2">
                Total <ProvenanceBadge kind="calculated" />
              </dt>
              <dd>{money(priced.total)}</dd>
            </div>
            <p className="text-right text-[11px] text-slate-400">Excludes tax{priced.delivery == null ? " and delivery" : ""}</p>
          </dl>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        {order.status === "draft" ? (
          <button type="button" disabled={!order.lines.length} onClick={() => setOrderStatus(order.id, "ready")} className={buttonClass("primary", "sm")}>
            Mark ready to send
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setOrderStatus(order.id, "sent", "Marked as sent by user")} className={buttonClass("accent", "sm")}>
              Mark as sent
            </button>
            <button type="button" onClick={() => setOrderStatus(order.id, "draft", "Reopened for editing")} className={buttonClass("ghost", "sm")}>
              Reopen draft
            </button>
          </>
        )}
        <button type="button" onClick={download} className={buttonClass("secondary", "sm")}>
          Download CSV
        </button>
        <button type="button" onClick={() => window.print()} className={buttonClass("ghost", "sm")}>
          Print
        </button>
        <button type="button" onClick={() => setOrderStatus(order.id, "cancelled", "Discarded draft")} className={buttonClass("ghost", "sm", "ml-auto text-red-700")}>
          Discard
        </button>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
