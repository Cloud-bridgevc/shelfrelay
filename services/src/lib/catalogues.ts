import type pg from "pg";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { extractCatalogue, type ExtractResult } from "../../../web/src/lib/engine";

export interface CatalogueDocument {
  id: string;
  organization_id: string;
  supplier_id: string;
  file_name: string;
  price_basis: "case" | "unit" | null;
}

/** S3 keys are written by the upload API as org/{orgId}/supplier/{supplierId}/{documentId}/{fileName}. */
export function parseKey(key: string) {
  const m = decodeURIComponent(key.replace(/\+/g, " ")).match(/^org\/([^/]+)\/supplier\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) throw new Error(`Unexpected catalogue key: ${key}`);
  return { organizationId: m[1], supplierId: m[2], documentId: m[3], fileName: m[4] };
}

export async function loadDocument(client: pg.PoolClient, documentId: string): Promise<CatalogueDocument> {
  const { rows } = await client.query<CatalogueDocument>(
    "SELECT id, organization_id, supplier_id, file_name, price_basis FROM catalogue_documents WHERE id = $1",
    [documentId],
  );
  if (!rows[0]) throw new Error(`Catalogue document ${documentId} not found`);
  return rows[0];
}

export function runExtraction(doc: CatalogueDocument, text: string, method: "csv" | "textract"): ExtractResult {
  return extractCatalogue(text, {
    supplierId: doc.supplier_id,
    file: doc.file_name,
    method,
    priceBasis: doc.price_basis ?? undefined,
  });
}

/**
 * Persist extracted items. Previous current rows for the supplier are kept as
 * history (is_current = false). Nothing is written for values the file did not state.
 */
export async function persistExtraction(client: pg.PoolClient, doc: CatalogueDocument, result: ExtractResult, method: "csv" | "textract") {
  const status = result.needsPriceBasis ? "needs_input" : result.items.length ? "imported" : "failed";
  await client.query(
    "UPDATE catalogue_documents SET status = $2, method = $3, column_mapping = $4, issues = $5, imported_at = CASE WHEN $2 = 'imported' THEN now() END WHERE id = $1",
    [doc.id, status, method, JSON.stringify(result.mapping), JSON.stringify(result.issues)],
  );
  if (status !== "imported") return { status, count: 0 };

  await client.query("UPDATE catalogue_items SET is_current = false WHERE supplier_id = $1 AND is_current", [doc.supplier_id]);
  for (const it of result.items) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO catalogue_items
         (organization_id, supplier_id, document_id, sku, name, brand, category, pack_raw, units_per_case, unit_size, base_unit,
          case_price, case_price_basis, stated_availability, source_row, source_page, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [
        doc.organization_id,
        doc.supplier_id,
        doc.id,
        it.sku,
        it.name,
        it.brand ?? null,
        it.category ?? null,
        it.pack?.raw ?? null,
        it.pack?.unitsPerCase ?? null,
        it.pack?.unitSize ?? null,
        it.pack?.baseUnit ?? null,
        it.casePrice,
        it.casePriceBasis,
        it.statedAvailability ?? null,
        it.source.row ?? null,
        it.source.page ?? null,
        JSON.stringify(it.raw),
      ],
    );
    for (const t of it.tiers) {
      await client.query("INSERT INTO catalogue_item_tiers (item_id, min_cases, case_price) VALUES ($1,$2,$3)", [rows[0].id, t.minCases, t.casePrice]);
    }
  }
  return { status, count: result.items.length };
}

const events = new EventBridgeClient({});

export async function emitImported(doc: CatalogueDocument, count: number) {
  await events.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: "shelfrelay.catalogues",
          DetailType: "catalogue.imported",
          Detail: JSON.stringify({ organizationId: doc.organization_id, supplierId: doc.supplier_id, documentId: doc.id, itemCount: count }),
        },
      ],
    }),
  );
}
