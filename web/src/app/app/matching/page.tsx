"use client";

import { useState } from "react";
import type { MatchCandidate, MatchStatus } from "@/lib/engine";
import { describePack, quoteLine } from "@/lib/engine";
import { useWorkspace } from "@/lib/workspace";
import { cn, money } from "@/lib/format";
import { Badge, buttonClass, Card, EmptyState, PageHeader, ProvenanceBadge } from "@/components/ui";
import { AnswerSource, useAssistant, type AssistantMessage } from "@/components/assistant-panel";

const TABS: { key: MatchStatus; label: string }[] = [
  { key: "needs_review", label: "Needs review" },
  { key: "proposed", label: "Proposed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "rejected", label: "Rejected" },
];

export default function MatchingPage() {
  const { state, setMatchStatus } = useWorkspace();
  const [tab, setTab] = useState<MatchStatus>("needs_review");
  const list = state.matches.filter((m) => m.status === tab);
  const proposed = state.matches.filter((m) => m.status === "proposed");

  return (
    <>
      <PageHeader
        eyebrow="Product matching review"
        title="Match review"
        description="Matches are suggestions until your team confirms them. Proposed matches are already used in comparisons, marked as unconfirmed."
        actions={
          proposed.length > 0 && (
            <button type="button" className={buttonClass("primary", "sm")} onClick={() => proposed.forEach((m) => setMatchStatus(m.id, "confirmed"))}>
              Confirm all {proposed.length} proposed
            </button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-[13px] sm:inline-flex" role="tablist">
        {TABS.map((t) => {
          const n = state.matches.filter((m) => m.status === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn("rounded-md px-3 py-1.5 font-medium", tab === t.key ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900")}
            >
              {t.label} <span className="tabular ml-1 text-slate-400">{n}</span>
            </button>
          );
        })}
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nothing here">No matches with this status.</EmptyState>
      ) : (
        <div className="space-y-4">
          {list.map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </>
  );
}

function MatchCard({ m }: { m: MatchCandidate }) {
  const { item, supplier, setMatchStatus, removeFromMatch, renameMatch } = useWorkspace();
  const ask = useAssistant();
  const [opinion, setOpinion] = useState<AssistantMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(m.label);
  const items = m.itemIds.map((id) => item(id)).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label !== m.label && renameMatch(m.id, label.trim())}
          aria-label="Product group name"
          className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-[15px] font-semibold text-navy-900 hover:border-slate-200 focus:border-slate-300"
        />
        <Badge tone={m.score >= 0.78 ? "green" : m.score >= 0.65 ? "amber" : "red"} title="Heuristic similarity across description, size, brand and category">
          {Math.round(m.score * 100)}% similar
        </Badge>
        <ProvenanceBadge kind={m.status === "confirmed" || m.status === "rejected" ? "user" : "ai"} note={m.status === "confirmed" ? "Confirmed by your team" : undefined} />
      </div>

      <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((i) => {
          const q = i.pack ? quoteLine(i, i.pack.unitsPerCase * i.pack.unitSize) : null;
          const unit = i.pack?.baseUnit === "ml" ? "L" : i.pack?.baseUnit === "g" ? "kg" : "unit";
          return (
            <div key={i.id} className="bg-white px-5 py-4">
              <p className="text-[12px] font-medium text-slate-500">{supplier(i.supplierId)?.name}</p>
              <p className="mt-0.5 font-medium text-navy-900">{i.name}</p>
              <dl className="mt-2 space-y-0.5 text-[12.5px] text-slate-600">
                <div>Brand: {i.brand ?? <span className="text-slate-400">not stated</span>}</div>
                <div>Pack: {i.pack ? `${describePack(i.pack)} (“${i.pack.raw}”)` : <span className="text-red-600">not stated</span>}</div>
                <div>
                  Case price: {money(i.casePrice)}
                  {q && (
                    <span className="text-slate-400">
                      {" "}
                      · {money(q.unitCost)}/{unit}
                    </span>
                  )}
                </div>
              </dl>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[11px] text-slate-400">
                  {i.source.file}#{i.source.row}
                </span>
                {m.status !== "rejected" && items.length > 2 && (
                  <button type="button" onClick={() => removeFromMatch(m.id, i.id)} className="text-[12px] font-medium text-red-700 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
        <div className="text-[13px]">
          {m.reasons.map((r) => (
            <p key={r} className="text-slate-600">
              <span className="mr-1.5 text-accent-600">✓</span>
              {r}
            </p>
          ))}
          {m.warnings.map((w) => (
            <p key={w} className="text-est-700">
              <span className="mr-1.5">!</span>
              {w}
            </p>
          ))}
        </div>
        <div>
          {opinion ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <AnswerSource source={opinion.source} model={opinion.model} />
              <div className="mt-2 space-y-1 text-[12.5px] text-slate-700">
                {opinion.lines.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setOpinion(await ask("Are these items equivalent products that can be compared? Explain any differences.", m));
                setBusy(false);
              }}
              className="text-[13px] font-medium text-ai-700 hover:underline"
            >
              {busy ? "Reviewing…" : "✦ Get a second opinion"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        {m.status !== "confirmed" && (
          <button type="button" onClick={() => setMatchStatus(m.id, "confirmed")} className={buttonClass("accent", "sm")}>
            Confirm match
          </button>
        )}
        {m.status !== "rejected" && (
          <button type="button" onClick={() => setMatchStatus(m.id, "rejected")} className={buttonClass("secondary", "sm")}>
            Not equivalent
          </button>
        )}
        {(m.status === "confirmed" || m.status === "rejected") && (
          <button type="button" onClick={() => setMatchStatus(m.id, "needs_review")} className={buttonClass("ghost", "sm")}>
            Move back to review
          </button>
        )}
      </div>
    </Card>
  );
}
