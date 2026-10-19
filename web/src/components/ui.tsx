import Link from "next/link";
import type { Provenance } from "@/lib/engine/types";
import { cn } from "@/lib/format";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "inverse";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm",
  accent: "bg-accent-600 text-white hover:bg-accent-700 shadow-sm",
  secondary: "bg-white text-navy-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  ghost: "text-navy-800 hover:bg-slate-100",
  inverse: "bg-white text-navy-900 hover:bg-navy-50 shadow-sm",
};

const sizes = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap",
    buttonStyles[variant],
    sizes[size],
    extra,
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]", className)}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "navy" | "green" | "amber" | "red" | "ai";
const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  navy: "bg-navy-50 text-navy-800 ring-navy-100",
  green: "bg-accent-50 text-accent-700 ring-accent-100",
  amber: "bg-est-50 text-est-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  ai: "bg-ai-50 text-ai-700 ring-indigo-200",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export const PROVENANCE: Record<Provenance, { label: string; tone: Tone; help: string; glyph: string }> = {
  imported: { label: "Imported", tone: "navy", glyph: "▢", help: "Stated in a supplier catalogue or terms sheet." },
  user: { label: "User-set", tone: "green", glyph: "✓", help: "Entered or confirmed by your team." },
  calculated: { label: "Calculated", tone: "neutral", glyph: "=", help: "Computed by ShelfRelay from imported and user-set values." },
  estimate: { label: "Estimate", tone: "amber", glyph: "≈", help: "Projected from recorded history; not a supplier commitment." },
  ai: { label: "AI suggestion", tone: "ai", glyph: "✦", help: "Proposed by a model or matching heuristic. Requires review." },
};

export function ProvenanceBadge({ kind, note }: { kind: Provenance; note?: string }) {
  const p = PROVENANCE[kind];
  return (
    <Badge tone={p.tone} title={note ?? p.help}>
      <span aria-hidden>{p.glyph}</span>
      {p.label}
    </Badge>
  );
}

export function ProvenanceLegend({ kinds = ["imported", "user", "calculated", "estimate", "ai"] as Provenance[], className }: { kinds?: Provenance[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-slate-500", className)}>
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <ProvenanceBadge kind={k} />
          <span className="hidden sm:inline">{PROVENANCE[k].help}</span>
        </span>
      ))}
    </div>
  );
}

export function Logo({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", inverse ? "text-white" : "text-navy-900", className)}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill={inverse ? "#ffffff" : "#0b1f3a"} />
        <path d="M8 11h11" stroke={inverse ? "#0b1f3a" : "#ffffff"} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M8 16.5h16" stroke="#25915f" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M8 22h8" stroke={inverse ? "#0b1f3a" : "#ffffff"} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M20.5 13.2 24 16.5l-3.5 3.3" fill="none" stroke="#25915f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[17px]">ShelfRelay</span>
    </span>
  );
}

export function Stat({ label, value, hint, provenance }: { label: string; value: React.ReactNode; hint?: React.ReactNode; provenance?: Provenance }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {provenance && <ProvenanceBadge kind={provenance} />}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold text-navy-900">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-slate-500">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <p className="font-medium text-navy-900">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-wider text-accent-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
