"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { buttonClass, Card } from "@/components/ui";
import { cn } from "@/lib/format";

const INTERESTS = ["Catalogue extraction", "Product matching", "Total cost comparison", "Replenishment", "Purchase orders", "Analytics"];

const input = "mt-1.5 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400";

export function DemoForm() {
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [crm, setCrm] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      company: fd.get("company"),
      role: fd.get("role"),
      businessType: fd.get("businessType"),
      locations: fd.get("locations"),
      supplierCount: fd.get("supplierCount"),
      interests: fd.getAll("interests"),
      message: fd.get("message"),
      plan: params.get("plan") ?? "",
      marketingOptIn: fd.get("marketingOptIn") === "on",
      website: fd.get("website"),
    };
    setState("sending");
    setErrors({});
    try {
      const res = await fetch("/api/demo-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.ok) {
        setCrm(json.crm);
        setState("done");
      } else {
        setErrors(json.errors ?? {});
        setMessage(json.error ?? "Please check the highlighted fields.");
        setState("error");
      }
    } catch {
      setMessage("Network error. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <Card className="p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-100 text-lg font-bold text-accent-700">✓</div>
        <h2 className="mt-5 text-xl font-semibold text-navy-900">Request received</h2>
        <p className="mt-2 text-slate-600">A procurement specialist will email you within one business day to arrange a time.</p>
        {crm === "local" && (
          <p className="mt-4 rounded-md bg-est-50 px-3 py-2 text-[12px] text-est-700">
            Development mode: HubSpot is not configured, so this request was saved to <code>.data/demo-requests.jsonl</code>.
          </p>
        )}
      </Card>
    );
  }

  const field = (name: string) => errors[name] && <p className="mt-1 text-[12px] text-red-600">{errors[name]}</p>;

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-navy-900">
          First name
          <input name="firstName" autoComplete="given-name" required className={cn(input, errors.firstName && "border-red-400")} />
          {field("firstName")}
        </label>
        <label className="text-sm font-medium text-navy-900">
          Last name
          <input name="lastName" autoComplete="family-name" required className={cn(input, errors.lastName && "border-red-400")} />
          {field("lastName")}
        </label>
        <label className="text-sm font-medium text-navy-900 sm:col-span-2">
          Work email
          <input name="email" type="email" autoComplete="email" required className={cn(input, errors.email && "border-red-400")} />
          {field("email")}
        </label>
        <label className="text-sm font-medium text-navy-900">
          Company
          <input name="company" autoComplete="organization" required className={cn(input, errors.company && "border-red-400")} />
          {field("company")}
        </label>
        <label className="text-sm font-medium text-navy-900">
          Role
          <input name="role" autoComplete="organization-title" placeholder="e.g. Owner, Buyer" className={input} />
        </label>
        <label className="text-sm font-medium text-navy-900">
          Business type
          <select name="businessType" defaultValue="independent_retailer" className={input}>
            <option value="independent_retailer">Independent retailer (1 location)</option>
            <option value="multi_store_retailer">Multi-store retailer</option>
            <option value="wholesaler">Wholesaler</option>
            <option value="distributor">Distributor</option>
            <option value="other">Other</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-navy-900">
            Locations
            <select name="locations" className={input} defaultValue="1">
              {["1", "2–5", "6–20", "20+"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-navy-900">
            Suppliers
            <select name="supplierCount" className={input} defaultValue="2–5">
              {["1", "2–5", "6–15", "15+"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-navy-900">Most interested in</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {INTERESTS.map((x) => (
              <label key={x} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-[13px] text-slate-700">
                <input type="checkbox" name="interests" value={x} className="h-4 w-4 accent-[#0b1f3a]" />
                {x}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-medium text-navy-900 sm:col-span-2">
          Anything we should know? <span className="font-normal text-slate-400">(optional)</span>
          <textarea name="message" rows={3} className={cn(input, "h-auto py-2")} />
        </label>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <label className="flex items-start gap-2 text-[13px] text-slate-600 sm:col-span-2">
          <input type="checkbox" name="marketingOptIn" className="mt-0.5 h-4 w-4 accent-[#0b1f3a]" />
          Send me occasional product updates. You can unsubscribe at any time.
        </label>
        {state === "error" && <p className="text-sm text-red-600 sm:col-span-2">{message}</p>}
        <div className="sm:col-span-2">
          <button type="submit" disabled={state === "sending"} className={buttonClass("primary", "lg", "w-full")}>
            {state === "sending" ? "Sending…" : "Request a demo"}
          </button>
          <p className="mt-3 text-center text-[12px] text-slate-500">We use these details only to arrange and follow up on your demo.</p>
        </div>
      </form>
    </Card>
  );
}
