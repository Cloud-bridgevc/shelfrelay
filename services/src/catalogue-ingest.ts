import type { S3Event } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { StartDocumentAnalysisCommand, TextractClient } from "@aws-sdk/client-textract";
import { withTenant } from "./lib/db";
import { emitImported, loadDocument, parseKey, persistExtraction, runExtraction } from "./lib/catalogues";

const s3 = new S3Client({});
const textract = new TextractClient({});

const TABULAR = /\.(csv|tsv|txt)$/i;
const DOCUMENT = /\.(pdf|png|jpe?g|tiff?)$/i;

/**
 * Triggered by s3:ObjectCreated on the catalogue bucket.
 *  - CSV/TSV: extracted synchronously with the shared engine.
 *  - PDF/images: an asynchronous Textract TABLES job is started; completion
 *    arrives via SNS at textract-complete.
 */
export async function handler(event: S3Event) {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;
    const { organizationId, documentId, fileName } = parseKey(key);

    if (TABULAR.test(fileName)) {
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: decodeURIComponent(key.replace(/\+/g, " ")) }));
      const text = await obj.Body!.transformToString("utf-8");
      const { doc, outcome } = await withTenant(organizationId, async (client) => {
        const doc = await loadDocument(client, documentId);
        const outcome = await persistExtraction(client, doc, runExtraction(doc, text, "csv"), "csv");
        return { doc, outcome };
      });
      if (outcome.status === "imported") await emitImported(doc, outcome.count);
      continue;
    }

    if (DOCUMENT.test(fileName)) {
      const job = await textract.send(
        new StartDocumentAnalysisCommand({
          DocumentLocation: { S3Object: { Bucket: bucket, Name: decodeURIComponent(key.replace(/\+/g, " ")) } },
          FeatureTypes: ["TABLES"],
          JobTag: documentId.slice(0, 64),
          NotificationChannel: { SNSTopicArn: process.env.TEXTRACT_TOPIC_ARN!, RoleArn: process.env.TEXTRACT_ROLE_ARN! },
        }),
      );
      await withTenant(organizationId, (client) =>
        client.query("UPDATE catalogue_documents SET status = 'extracting', method = 'textract', textract_job_id = $2 WHERE id = $1", [documentId, job.JobId]),
      );
      continue;
    }

    await withTenant(organizationId, (client) =>
      client.query(
        "UPDATE catalogue_documents SET status = 'failed', issues = $2 WHERE id = $1",
        [documentId, JSON.stringify([{ severity: "error", message: "Unsupported file type." }])],
      ),
    );
  }
}
