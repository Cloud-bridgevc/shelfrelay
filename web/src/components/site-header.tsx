"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink, Logo } from "./ui";
import { cn } from "@/lib/format";

const NAV = [
  { href: "/#platform", label: "Platform" },
  { href: "/retailers", label: "Retailers" },
  { href: "/wholesalers", label: "Wholesalers" },
  { href: "/compare", label: "Live comparison" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="ShelfRelay home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-3 py-2 text-[14px] text-slate-600 hover:text-navy-900",
                path === n.href && "font-medium text-navy-900",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/app" variant="ghost" size="sm">
            Open demo workspace
          </ButtonLink>
          <ButtonLink href="/demo" size="sm">
            Request a demo
          </ButtonLink>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-navy-900 md:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <path d={open ? "M5 5l10 10M15 5L5 15" : "M3 6h14M3 10h14M3 14h14"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden" aria-label="Mobile">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2.5 text-[15px] text-slate-700">
              {n.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2">
            <ButtonLink href="/app" variant="secondary" size="sm" className="flex-1">
              Demo workspace
            </ButtonLink>
            <ButtonLink href="/demo" size="sm" className="flex-1">
              Request a demo
            </ButtonLink>
          </div>
        </nav>
      )}
    </header>
  );
}
