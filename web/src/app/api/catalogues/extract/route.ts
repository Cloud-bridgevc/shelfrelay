import { NextResponse } from "next/server";
import { extractCatalogue } from "@/lib/engine";

const MAX_BYTES = 5 * 1024 * 1024;
const TEXT_TYPES = /\.(csv|tsv|txt)$/i;
const DOC_TYPES = /\.(pdf|png|jpe?g|tiff?)$/i;

/**
 * Synchronous extraction for tabular files. PDFs and images are processed by
 * the AWS pipeline (S3 upload → Textract table analysis → Lambda), which
 * calls the same extractCatalogue() on Textract's table output.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const supplierId = String(form?.get("supplierId") ?? "");
  const priceBasis = form?.get("priceBasis");
  if (!(file instanceof File) || !supplierId) {
    return NextResponse.json({ error: "Choose a supplier and a file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 5 MB." }, { status: 413 });

  if (DOC_TYPES.test(file.name)) {
    return NextResponse.json(
      {
        error:
          "PDF and image catalogues are extracted by Amazon Textract in the AWS deployment (S3 → Textract → Lambda). That pipeline isn't connected in this local demo, so upload a CSV or TSV export instead.",
      },
      { status: 501 },
    );
  }
  if (!TEXT_TYPES.test(file.name)) {
    return NextResponse.json({ error: "Supported here: .csv, .tsv, .txt. Export spreadsheets as CSV." }, { status: 415 });
  }

  const text = await file.text();
  const result = extractCatalogue(text, {
    supplierId,
    file: file.name,
    priceBasis: priceBasis === "case" || priceBasis === "unit" ? priceBasis : undefined,
  });
  return NextResponse.json(result);
}
