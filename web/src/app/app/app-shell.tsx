"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui";
import { AssistantPanel } from "@/components/assistant-panel";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/format";

const NAV: { href: string; label: string; icon: string; badge?: "review" | "orders" }[] = [
  { href: "/app", label: "Overview", icon: "M3 10.5 10 4l7 6.5V17H3z" },
  { href: "/app/suppliers", label: "Suppliers", icon: "M3 16V7l7-3 7 3v9M7 16v-5h6v5" },
  { href: "/app/catalogues", label: "Catalogue upload", icon: "M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4 13v3h12v-3" },
  { href: "/app/matching", label: "Matching review", icon: "M5 6h4v4H5zM11 10h4v4h-4zM9 8h2v4", badge: "review" },
  { href: "/app/compare", label: "Supplier comparison", icon: "M4 16V9M8 16V5M12 16v-4M16 16V7" },
  { href: "/app/replenishment", label: "Inventory & replenishment", icon: "M4 6h12M4 10h12M4 14h7" },
  { href: "/app/orders", label: "Purchase orders", icon: "M5 3h7l3 3v11H5zM8 9h5M8 12h5", badge: "orders" },
  { href: "/app/tracking", label: "Order tracking", icon: "M3 10h3l2-5 4 10 2-5h3" },
  { href: "/app/analytics", label: "Analytics", icon: "M4 16 8 10l3 3 5-7" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state, reset } = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const reviewCount = state.matches.filter((m) => m.status === "needs_review").length;
  const draftCount = state.orders.filter((o) => o.status === "draft").length;

  const nav = (
    <nav className="space-y-0.5 px-3" aria-label="Workspace">
      {NAV.map((n) => {
        const active = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
        const count = n.badge === "review" ? reviewCount : n.badge === "orders" ? draftCount : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setNavOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-colors",
              active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={n.icon} />
            </svg>
            <span className="flex-1">{n.label}</span>
            {count > 0 && (
              <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", n.badge === "review" ? "bg-amber-400/90 text-navy-950" : "bg-white/15 text-white")}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-900 py-5 lg:flex">
        <Link href="/" className="px-6">
          <Logo inverse />
        </Link>
        <div className="mx-3 mt-6 rounded-lg bg-white/5 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Workspace</p>
          <p className="text-sm font-medium text-white">Larkspur Market</p>
          <p className="text-[11px] text-slate-400">Fictional demo store</p>
        </div>
        <div className="mt-5 flex-1 overflow-y-auto">{nav}</div>
        <div className="space-y-1 px-3">
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="flex w-full items-center gap-3 rounded-md bg-accent-600 px-3 py-2.5 text-[13.5px] font-medium text-white hover:bg-accent-700"
          >
            <span aria-hidden>✦</span> Procurement assistant
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset the demo workspace? Your changes in this browser will be cleared.")) reset();
            }}
            className="w-full rounded-md px-3 py-2 text-left text-[12px] text-slate-400 hover:text-white"
          >
            Reset demo data
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="lg:hidden" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <p className="min-w-0 flex-1 truncate text-[12.5px] text-slate-500">
            <span className="mr-2 rounded bg-est-50 px-1.5 py-0.5 font-medium text-est-700">Demo</span>
            Fictional suppliers and store records. Changes are saved in this browser only.
          </p>
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-[13px] font-medium text-navy-900 hover:bg-slate-50 lg:hidden"
          >
            ✦ Assistant
          </button>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">{children}</main>
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-navy-900 py-5">
            <div className="mb-5 px-6">
              <Logo inverse />
            </div>
            {nav}
          </div>
        </div>
      )}

      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
