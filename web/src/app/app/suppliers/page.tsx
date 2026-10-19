"use client";

import { useState } from "react";
import type { Supplier } from "@/lib/engine";
import { useWorkspace } from "@/lib/workspace";
import { money } from "@/lib/format";
import { Badge, buttonClass, Card, CardHeader, PageHeader, ProvenanceBadge } from "@/components/ui";

const KIND: Record<Supplier["kind"], string> = {
  wholesaler: "Wholesaler",
  distributor: "Distributor",
  cash_and_carry: "Cash & carry",
  direct: "Direct from producer",
};

const field = "mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm";

export default function SuppliersPage() {
  const { state, updateSupplier, addSupplier } = useWorkspace();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Supplier directory"
        title="Suppliers"
        description="Terms as stated by each supplier, plus the planning settings your team controls."
        actions={
          <button type="button" className={buttonClass("primary", "sm")} onClick={() => setAdding(true)}>
            Add supplier
          </button>
        }
      />

      {adding && <AddSupplier onDone={() => setAdding(false)} onAdd={addSupplier} />}

      <div className="grid gap-5 xl:grid-cols-2">
        {state.suppliers.map((s) => {
          const items = state.items.filter((i) => i.supplierId === s.id);
          const priced = items.filter((i) => i.casePrice != null && i.pack).length;
          const userEdited = s.terms.source?.method === "manual" && s.terms.source.file === "user";
          const prov = userEdited ? "user" : "imported";
          const t = s.terms;
          return (
            <Card key={s.id}>
              <CardHeader
                title={s.name}
                description={
                  <>
                    {KIND[s.kind]}
                    {s.region && ` · ${s.region}`}
                  </>
                }
                action={
                  <div className="flex items-center gap-2">
                    {s.fictional && <Badge tone="amber">Fictional</Badge>}
                    <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setEditing(editing === s.id ? null : s.id)}>
                      {editing === s.id ? "Close" : "Edit"}
                    </button>
                  </div>
                }
              />
              {editing === s.id ? (
                <EditTerms supplier={s} onSave={(terms) => (updateSupplier(s.id, { terms }), setEditing(null))} />
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-[13.5px] sm:grid-cols-3">
                  <Term label="Delivery" prov={t.deliveryFee == null ? null : prov}>
                    {t.deliveryFee == null ? "Not stated" : t.deliveryFee === 0 ? "Included" : money(t.deliveryFee)}
                  </Term>
                  <Term label="Free delivery from" prov={t.freeDeliveryThreshold == null ? null : prov}>
                    {t.freeDeliveryThreshold == null ? "—" : money(t.freeDeliveryThreshold)}
                  </Term>
                  <Term label="Minimum order" prov={t.minimumOrderValue == null ? null : prov}>
                    {t.minimumOrderValue == null ? "Not stated" : t.minimumOrderValue === 0 ? "None" : money(t.minimumOrderValue)}
                  </Term>
                  <Term label="Volume discount" prov={prov}>
                    {t.volumeDiscounts.length ? t.volumeDiscounts.map((d) => `${d.percent}% ≥ ${money(d.minSubtotal)}`).join(", ") : "None stated"}
                  </Term>
                  <Term label="Stated lead time" prov={t.statedLeadTime ? prov : null}>
                    {t.statedLeadTime ?? "Not stated"}
                  </Term>
                  <Term label="Planning lead time" prov={t.planningLeadTimeDays == null ? null : "user"}>
                    {t.planningLeadTimeDays == null ? "Not set" : `${t.planningLeadTimeDays} day(s)`}
                  </Term>
                  <Term label="Payment terms" prov={t.paymentTerms ? prov : null}>
                    {t.paymentTerms ?? "Not stated"}
                  </Term>
                  <Term label="Catalogue">
                    {items.length} items · {priced} fully priced
                  </Term>
                  <Term label="Terms source">{t.source ? (userEdited ? "Edited by your team" : t.source.file) : "—"}</Term>
                </dl>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Term({ label, prov, children }: { label: string; prov?: "imported" | "user" | null; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
        {prov === null && <Badge tone="amber">Missing</Badge>}
      </dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 text-navy-900">
        {children}
        {prov && <ProvenanceBadge kind={prov} />}
      </dd>
    </div>
  );
}

const toNum = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? null : Number(v));

function EditTerms({ supplier, onSave }: { supplier: Supplier; onSave: (t: Partial<Supplier["terms"]>) => void }) {
  const t = supplier.terms;
  return (
    <form
      className="grid gap-4 px-5 py-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const discMin = toNum(fd.get("discMin"));
        const discPct = toNum(fd.get("discPct"));
        onSave({
          deliveryFee: toNum(fd.get("deliveryFee")),
          freeDeliveryThreshold: toNum(fd.get("freeDeliveryThreshold")),
          minimumOrderValue: toNum(fd.get("minimumOrderValue")),
          planningLeadTimeDays: toNum(fd.get("planningLeadTimeDays")),
          statedLeadTime: String(fd.get("statedLeadTime") ?? "").trim() || null,
          paymentTerms: String(fd.get("paymentTerms") ?? "").trim() || null,
          volumeDiscounts: discMin != null && discPct != null ? [{ minSubtotal: discMin, percent: discPct }] : [],
          source: { file: "user", method: "manual" },
        });
      }}
    >
      <p className="text-[12px] text-slate-500 sm:col-span-3">
        Leave a field blank if the supplier hasn&apos;t stated it. Only enter values the supplier has confirmed; saved terms are marked as user-set.
      </p>
      {[
        ["deliveryFee", "Delivery fee ($)", t.deliveryFee],
        ["freeDeliveryThreshold", "Free delivery from ($)", t.freeDeliveryThreshold],
        ["minimumOrderValue", "Minimum order ($, 0 = none)", t.minimumOrderValue],
        ["discMin", "Discount from subtotal ($)", t.volumeDiscounts[0]?.minSubtotal ?? null],
        ["discPct", "Discount (%)", t.volumeDiscounts[0]?.percent ?? null],
        ["planningLeadTimeDays", "Planning lead time (days)", t.planningLeadTimeDays],
      ].map(([name, label, v]) => (
        <label key={name as string} className="text-[13px] font-medium text-navy-900">
          {label as string}
          <input name={name as string} type="number" min={0} step="any" defaultValue={v == null ? "" : String(v)} className={field} />
        </label>
      ))}
      <label className="text-[13px] font-medium text-navy-900 sm:col-span-2">
        Stated lead time (as written by supplier)
        <input name="statedLeadTime" defaultValue={t.statedLeadTime ?? ""} className={field} />
      </label>
      <label className="text-[13px] font-medium text-navy-900">
        Payment terms
        <input name="paymentTerms" defaultValue={t.paymentTerms ?? ""} className={field} />
      </label>
      <div className="sm:col-span-3">
        <button type="submit" className={buttonClass("primary", "sm")}>
          Save terms
        </button>
      </div>
    </form>
  );
}

function AddSupplier({ onAdd, onDone }: { onAdd: (s: Supplier) => void; onDone: () => void }) {
  return (
    <Card className="mb-5">
      <CardHeader title="Add supplier" description="Add terms now or after uploading their catalogue." />
      <form
        className="grid gap-4 px-5 py-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const name = String(fd.get("name") ?? "").trim();
          if (!name) return;
          const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36).slice(-4);
          onAdd({
            id,
            name,
            kind: (fd.get("kind") as Supplier["kind"]) ?? "wholesaler",
            contactEmail: String(fd.get("email") ?? "") || undefined,
            terms: {
              deliveryFee: null,
              freeDeliveryThreshold: null,
              minimumOrderValue: null,
              volumeDiscounts: [],
              statedLeadTime: null,
              planningLeadTimeDays: null,
              paymentTerms: null,
              source: null,
            },
          });
          onDone();
        }}
      >
        <label className="text-[13px] font-medium text-navy-900">
          Name
          <input name="name" required className={field} />
        </label>
        <label className="text-[13px] font-medium text-navy-900">
          Type
          <select name="kind" className={field}>
            {Object.entries(KIND).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-medium text-navy-900">
          Order contact email
          <input name="email" type="email" className={field} />
        </label>
        <div className="flex gap-2 sm:col-span-3">
          <button type="submit" className={buttonClass("primary", "sm")}>
            Add supplier
          </button>
          <button type="button" onClick={onDone} className={buttonClass("ghost", "sm")}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
