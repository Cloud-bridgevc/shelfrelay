import type { EventBridgeEvent } from "aws-lambda";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type pg from "pg";
import { findMatches, type CatalogueItem, type MatchCandidate } from "../../web/src/lib/engine";
import { withTenant } from "./lib/db";

const bedrock = new BedrockRuntimeClient({});

const REVIEW_PROMPT = `You review whether supplier catalogue items describe the same product for price comparison.
Use ONLY the item fields provided. Do not assume facts not present.
Reply with JSON only: {"verdict":"equivalent"|"not_equivalent"|"uncertain","rationale":"<= 60 words"}.
Treat differing variants (e.g. diet vs regular, barista vs original, flavour) as not_equivalent.
Treat differing unit sizes of the same product as equivalent only for per-unit comparison, and say so.`;

interface ImportedDetail {
  organizationId: string;
}

/**
 * Re-runs heuristic matching after a catalogue import, then asks Bedrock for
 * an advisory second opinion on each group that needs review. AI reviews are
 * stored separately and never change a group's status; only a user can
 * confirm or reject.
 */
export async function handler(event: EventBridgeEvent<"catalogue.imported", ImportedDetail>) {
  const { organizationId } = event.detail;
  const created = await withTenant(organizationId, async (client) => {
    const items = await loadItems(client);
    const decided = await client.query<{ item_id: string; status: string; key: string }>(
      `SELECT gi.item_id, g.status, string_agg(gi2.item_id::text, '|' ORDER BY gi2.item_id) AS key
         FROM product_groups g
         JOIN product_group_items gi ON gi.group_id = g.id
         JOIN product_group_items gi2 ON gi2.group_id = g.id
        WHERE g.status IN ('confirmed', 'rejected')
        GROUP BY gi.item_id, g.status`,
    );
    const confirmedItems = new Set(decided.rows.filter((r) => r.status === "confirmed").map((r) => r.item_id));
    const rejectedKeys = new Set(decided.rows.filter((r) => r.status === "rejected").map((r) => r.key));

    // Clear undecided suggestions; they are regenerated from current catalogues.
    await client.query("DELETE FROM product_groups WHERE status IN ('proposed', 'needs_review')");

    const out: { id: string; candidate: MatchCandidate }[] = [];
    for (const m of findMatches(items.filter((i) => !confirmedItems.has(i.id)))) {
      if (rejectedKeys.has([...m.itemIds].sort().join("|"))) continue;
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO product_groups (organization_id, label, base_unit, status, heuristic_score, reasons, warnings)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [organizationId, m.label, m.baseUnit, m.status, m.score, JSON.stringify(m.reasons), JSON.stringify(m.warnings)],
      );
      for (const itemId of m.itemIds) {
        const it = items.find((i) => i.id === itemId)!;
        await client.query("INSERT INTO product_group_items (group_id, item_id, supplier_id) VALUES ($1,$2,$3)", [rows[0].id, itemId, it.supplierId]);
      }
      out.push({ id: rows[0].id, candidate: m });
    }
    return { out, items };
  });

  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) return;
  for (const { id, candidate } of created.out.filter((c) => c.candidate.status === "needs_review")) {
    const facts = candidate.itemIds.map((itemId) => {
      const it = created.items.find((i) => i.id === itemId)!;
      return { supplier: it.supplierId, name: it.name, brand: it.brand ?? null, pack: it.pack?.raw ?? null, category: it.category ?? null };
    });
    try {
      const res = await bedrock.send(
        new ConverseCommand({
          modelId,
          system: [{ text: REVIEW_PROMPT }],
          messages: [{ role: "user", content: [{ text: JSON.stringify({ items: facts, heuristicWarnings: candidate.warnings }) }] }],
          inferenceConfig: { maxTokens: 300, temperature: 0 },
        }),
      );
      const text = res.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? "";
      const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { verdict: string; rationale: string };
      if (!["equivalent", "not_equivalent", "uncertain"].includes(parsed.verdict)) continue;
      await withTenant(organizationId, (client) =>
        client.query("INSERT INTO match_ai_reviews (group_id, model_id, verdict, rationale) VALUES ($1,$2,$3,$4)", [id, modelId, parsed.verdict, parsed.rationale.slice(0, 600)]),
      );
    } catch (e) {
      // Advisory only: a failed review leaves the group in the human queue.
      console.warn("Bedrock review failed", id, e);
    }
  }
}

async function loadItems(client: pg.PoolClient): Promise<CatalogueItem[]> {
  const { rows } = await client.query(
    `SELECT i.*, d.file_name, d.method,
            COALESCE(json_agg(json_build_object('minCases', t.min_cases, 'casePrice', t.case_price)) FILTER (WHERE t.item_id IS NOT NULL), '[]') AS tiers
       FROM catalogue_items i
       JOIN catalogue_documents d ON d.id = i.document_id
       LEFT JOIN catalogue_item_tiers t ON t.item_id = i.id
      WHERE i.is_current
      GROUP BY i.id, d.file_name, d.method`,
  );
  return rows.map((r) => ({
    id: r.id,
    supplierId: r.supplier_id,
    sku: r.sku,
    name: r.name,
    brand: r.brand ?? undefined,
    category: r.category ?? undefined,
    pack: r.units_per_case ? { raw: r.pack_raw, unitsPerCase: r.units_per_case, unitSize: Number(r.unit_size), baseUnit: r.base_unit } : null,
    casePrice: r.case_price == null ? null : Number(r.case_price),
    casePriceBasis: r.case_price_basis,
    tiers: (r.tiers as { minCases: number; casePrice: string }[]).map((t) => ({ minCases: t.minCases, casePrice: Number(t.casePrice) })),
    statedAvailability: r.stated_availability ?? undefined,
    source: { file: r.file_name, row: r.source_row ?? undefined, page: r.source_page ?? undefined, method: r.method },
    raw: r.raw,
  }));
}
