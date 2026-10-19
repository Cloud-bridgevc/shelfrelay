import "server-only";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import {
  assistantContext,
  compare,
  explainComparison,
  findMissingInfo,
  type CatalogueItem,
  type MatchCandidate,
  type ProductGroup,
  type Supplier,
} from "@/lib/engine";

export interface AssistantRequest {
  question: string;
  suppliers: Supplier[];
  items: CatalogueItem[];
  groups: ProductGroup[];
  basket: Record<string, number>;
  /** When set, the assistant reviews one match candidate. */
  match?: MatchCandidate;
}

export interface AssistantAnswer {
  source: "bedrock" | "rules";
  lines: string[];
  model?: string;
}

const SYSTEM_PROMPT = `You are the ShelfRelay procurement assistant for an independent retailer.
Answer ONLY from the JSON CONTEXT supplied by the application. Rules:
- Never invent or estimate supplier prices, availability, lead times or delivery dates. If a value is null or absent, say it is not stated.
- Distinguish clearly between values imported from supplier catalogues, values calculated by ShelfRelay, and your own suggestions.
- When you mention a price or term, cite the supplier and item id (e.g. northgate:NP-1001) or the source file.
- Product equivalence is a suggestion until a user confirms it. Say so when relevant.
- Be concise: short paragraphs or bullet points, plain text, no tables.`;

export async function answer(req: AssistantRequest): Promise<AssistantAnswer> {
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (modelId) {
    try {
      return await askBedrock(req, modelId);
    } catch (e) {
      console.error("Bedrock request failed; falling back to rules", e);
    }
  }
  return { source: "rules", lines: ruleBased(req) };
}

async function askBedrock(req: AssistantRequest, modelId: string): Promise<AssistantAnswer> {
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const cmp = compare(Object.entries(req.basket).map(([groupId, required]) => ({ groupId, required })), req.groups, req.items, req.suppliers);
  const context = {
    ...assistantContext(req.suppliers, req.items, req.groups, cmp),
    ruleBasedAnalysis: explainComparison(cmp, req.groups, req.suppliers, req.items),
    matchUnderReview: req.match ?? null,
  };
  const res = await client.send(
    new ConverseCommand({
      modelId,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: "user", content: [{ text: `CONTEXT:\n${JSON.stringify(context)}\n\nQUESTION:\n${req.question}` }] }],
      inferenceConfig: { maxTokens: 700, temperature: 0.1 },
    }),
  );
  const text = res.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? "";
  return { source: "bedrock", model: modelId, lines: text.split(/\n+/).map((l) => l.trim()).filter(Boolean) };
}

function ruleBased(req: AssistantRequest): string[] {
  const q = req.question.toLowerCase();
  const { suppliers, items, groups } = req;
  const named = suppliers.filter((s) => q.includes(s.name.toLowerCase().split(" ")[0]));

  if (req.match) return reviewMatch(req.match, items, suppliers);

  if (/missing|gap|incomplete|unknown|not stated|tbc/.test(q)) {
    const missing = findMissingInfo(named.length ? named : suppliers, items.filter((i) => !named.length || named.some((s) => s.id === i.supplierId)));
    if (!missing.length) return ["No missing pricing or terms found for the selected suppliers."];
    const blocking = missing.filter((m) => m.severity === "blocking");
    return [
      `Found ${missing.length} gap(s), ${blocking.length} of which affect cost comparisons:`,
      ...blocking.map((m) => `• ${m.message}`),
      ...missing.filter((m) => m.severity === "warning").map((m) => `• ${m.message}`),
      "Ask the supplier to confirm these, or enter confirmed values in the supplier directory (they'll be marked as user-set).",
    ];
  }

  const cmp = compare(Object.entries(req.basket).map(([groupId, required]) => ({ groupId, required })), groups, items, suppliers);

  if (named.length >= 2) {
    return named.flatMap((s) => termsSummary(s)).concat(explainComparison(cmp, groups, suppliers, items).filter((l) => named.some((s) => l.includes(s.name))));
  }
  if (named.length === 1 && !/cheap|why|compare|cost/.test(q)) return termsSummary(named[0]);

  if (/summar|option|plan|which supplier|best|cheap|why|compare|differ|cost|recommend/.test(q)) {
    return explainComparison(cmp, groups, suppliers, items);
  }

  return [
    "I can answer from your workspace data. Try:",
    "• “Why is the recommended plan cheapest?”",
    "• “What pricing information is missing?”",
    "• “Compare Northgate and Meridian.”",
    "• “Summarize my purchasing options.”",
  ];
}

function termsSummary(s: Supplier): string[] {
  const t = s.terms;
  const v = (x: number | null, f = (n: number) => `$${n.toFixed(2)}`) => (x == null ? "not stated" : f(x));
  return [
    `${s.name} — stated terms:`,
    `• Delivery: ${t.deliveryFee === 0 ? "included" : v(t.deliveryFee)}${t.freeDeliveryThreshold != null ? `, free at or above ${v(t.freeDeliveryThreshold)}` : ""}`,
    `• Minimum order: ${t.minimumOrderValue === 0 ? "none" : v(t.minimumOrderValue)}`,
    `• Volume discounts: ${t.volumeDiscounts.length ? t.volumeDiscounts.map((d) => `${d.percent}% at ${v(d.minSubtotal)}+`).join(", ") : "none stated"}`,
    `• Lead time: ${t.statedLeadTime ?? "not stated"}; planning lead time ${t.planningLeadTimeDays == null ? "not set" : `${t.planningLeadTimeDays} day(s) (user-set)`}`,
    `• Payment: ${t.paymentTerms ?? "not stated"}`,
  ];
}

function reviewMatch(m: MatchCandidate, items: CatalogueItem[], suppliers: Supplier[]): string[] {
  const its = m.itemIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as CatalogueItem[];
  const sName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;
  return [
    `Rule-based review of “${m.label}” (similarity ${Math.round(m.score * 100)}%):`,
    ...its.map((i) => `• ${sName(i.supplierId)}: “${i.name}”${i.brand ? `, brand ${i.brand}` : ""}, pack ${i.pack?.raw ?? "not stated"}`),
    ...m.reasons.map((r) => `✓ ${r}`),
    ...m.warnings.map((w) => `! ${w}`),
    m.warnings.length
      ? "Recommendation: confirm only if these differences are acceptable substitutes for your customers; otherwise remove the differing item."
      : "No conflicting attributes found. Confirm if the descriptions refer to the same product.",
  ];
}
