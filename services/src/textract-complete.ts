import type { SNSEvent } from "aws-lambda";
import { GetDocumentAnalysisCommand, TextractClient, type Block } from "@aws-sdk/client-textract";
import { db, withTenant } from "./lib/db";
import { emitImported, loadDocument, persistExtraction, runExtraction } from "./lib/catalogues";
import { rowsToCsv, tablesFromBlocks } from "./lib/textract-tables";

const textract = new TextractClient({});

interface TextractNotification {
  JobId: string;
  Status: "SUCCEEDED" | "FAILED" | "ERROR";
  JobTag?: string;
}

/**
 * Receives Textract job completion, collects all result pages, picks the
 * table that best matches a catalogue (most mapped columns), and runs the
 * shared extraction. Textract confidence below 80% on a price or pack cell
 * is reported as a warning so a person checks it.
 */
export async function handler(event: SNSEvent) {
  for (const record of event.Records) {
    const msg = JSON.parse(record.Sns.Message) as TextractNotification;
    const pool = await db();
    const { rows } = await pool.query<{ id: string; organization_id: string }>(
      "SELECT id, organization_id FROM catalogue_documents WHERE textract_job_id = $1",
      [msg.JobId],
    );
    const ref = rows[0];
    if (!ref) continue;

    if (msg.Status !== "SUCCEEDED") {
      await withTenant(ref.organization_id, (c) =>
        c.query("UPDATE catalogue_documents SET status = 'failed', issues = $2 WHERE id = $1", [
          ref.id,
          JSON.stringify([{ severity: "error", message: `Textract job ${msg.Status.toLowerCase()}` }]),
        ]),
      );
      continue;
    }

    const blocks: Block[] = [];
    let token: string | undefined;
    do {
      const page = await textract.send(new GetDocumentAnalysisCommand({ JobId: msg.JobId, NextToken: token }));
      blocks.push(...(page.Blocks ?? []));
      token = page.NextToken;
    } while (token);

    const lowConfidence = blocks.filter((b) => b.BlockType === "CELL" && (b.Confidence ?? 100) < 80).length;
    const tables = tablesFromBlocks(blocks);

    const { doc, outcome } = await withTenant(ref.organization_id, async (client) => {
      const doc = await loadDocument(client, ref.id);
      // Choose the table whose header maps the most catalogue fields.
      let best = runExtraction(doc, "", "textract");
      for (const t of tables) {
        const r = runExtraction(doc, rowsToCsv(t.rows), "textract");
        if (r.items.length > best.items.length) best = { ...r, items: r.items.map((i) => ({ ...i, source: { ...i.source, page: t.page } })) };
      }
      if (lowConfidence) {
        best.issues.push({ severity: "warning", message: `${lowConfidence} table cell(s) were read with low OCR confidence; check prices and pack sizes against the original.` });
      }
      const outcome = await persistExtraction(client, doc, best, "textract");
      return { doc, outcome };
    });
    if (outcome.status === "imported") await emitImported(doc, outcome.count);
  }
}
