import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Logo } from "@/components/ui";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-navy-950 text-slate-400">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo inverse />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              Procurement intelligence for independent retailers and consumer-goods wholesalers.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["/#platform", "Platform"],
              ["/compare", "Live comparison"],
              ["/pricing", "Pricing"],
              ["/app", "Demo workspace"],
            ]}
          />
          <FooterCol
            title="Solutions"
            links={[
              ["/retailers", "Independent retailers"],
              ["/wholesalers", "Wholesalers & distributors"],
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              ["/demo", "Request a demo"],
              ["/#trust", "Data & AI principles"],
            ]}
          />
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-4 py-5 text-[12px] sm:px-6">
            © {new Date().getFullYear()} ShelfRelay. All suppliers, products and prices shown on this site are fictional demonstration data.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-300">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
