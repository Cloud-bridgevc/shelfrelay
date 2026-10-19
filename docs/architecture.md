# Architecture

```
                    ┌──────────────────────────── Next.js app (web/) ────────────────────────────┐
 Browser ──────────►│ Public site · Workspace UI · /api/catalogues/extract · /api/assistant ·     │
                    │ /api/demo-request                                                           │
                    └───────┬───────────────────────────┬──────────────────────────┬──────────────┘
                            │ presigned PUT              │ Converse                 │ CRM v3
                            ▼                            ▼                          ▼
                     ┌─────────────┐             ┌──────────────┐            ┌──────────┐
                     │ S3 (KMS)    │             │ Bedrock      │            │ HubSpot  │
                     │ catalogues  │             └──────────────┘            └──────────┘
                     └──────┬──────┘                    ▲                          ▲
             ObjectCreated  │                           │                          │
                            ▼                           │                          │
              ┌──────────────────────────┐   SNS   ┌────┴──────────────┐   ┌───────┴────────┐
              │ catalogue-ingest (λ)     │──Textract─►textract-complete│   │ hubspot-sync λ │
              │ CSV/TSV → engine         │  async  │ tables → engine    │   └───────▲────────┘
              │ PDF/image → Textract job │         └────────┬──────────┘           │
              └────────────┬─────────────┘                  │                       │
                           └──────── catalogue.imported ────┴──► EventBridge ───────┤
                                                                     │              │
                                                                     ▼              │
                                                          ┌───────────────────┐     │
                                                          │ match-assist (λ)  │     │
                                                          │ heuristic groups  │     │
                                                          │ + Bedrock review  │     │
                                                          └─────────┬─────────┘     │
                                                                    ▼               │
                                                     Aurora PostgreSQL (db/schema.sql) ◄──┘
```

## One engine, two runtimes

All domain logic lives in [web/src/lib/engine](../web/src/lib/engine) as dependency-free TypeScript:

| Module | Responsibility |
|---|---|
| `units.ts` | Parse pack descriptions (`24x330ml`, `6 x 4 x 330ml`, `Case of 12 rolls`) into units per case, unit size and base unit |
| `extract.ts` | Delimited-file parsing, header synonym mapping, tier columns, price basis, issue reporting |
| `match.ts` | Cross-supplier similarity scoring and grouping (one item per supplier per group) |
| `cost.ts` | Line quotes with case rounding and tiers; order pricing with discounts, delivery and minimums; supplier-subset search for the lowest valid plan |
| `replenish.ts` | Reorder point / order-up-to from recorded sales, rounded to the chosen supplier's case |
| `explain.ts` | Missing-information detection, rule-based explanations, grounding context for Bedrock |

The Next.js app imports it directly; the Lambda bundles (`services/build.mjs`) compile the same files in, so a catalogue extracted in the browser demo and one extracted by Lambda produce identical results.

## AWS services

| Service | Use |
|---|---|
| **Amazon S3** | Catalogue originals under `org/{org}/supplier/{supplier}/{document}/{file}`. SSE-KMS, versioned, public access blocked, TLS-only policy. Browser uploads use presigned PUT URLs. |
| **Amazon Textract** | `StartDocumentAnalysis` with `TABLES` for PDFs and scans. Results are converted to rows (`services/src/lib/textract-tables.ts`), merged across pages, and run through the same extractor. Cells under 80% confidence raise a review warning. CSV/TSV never go to Textract. |
| **Amazon Bedrock** | (1) Advisory second opinion on `needs_review` matches, stored in `match_ai_reviews` and never changing status. (2) The procurement assistant, grounded on a JSON context of the workspace with a system prompt forbidding invented prices, availability or dates. Both are optional; without a model ID, rule-based output is shown and labelled as such. |
| **PostgreSQL** (Aurora Serverless v2) | Suppliers, versioned terms, catalogue items with source row, tiers, product groups, inventory, POs and CRM sync log. Row-level security per organization. |
| **AWS Lambda** | `catalogue-ingest`, `textract-complete`, `match-assist`, `hubspot-sync`; arm64, Node.js 22, in private subnets with VPC endpoints, failures to an SQS DLQ with an alarm. |
| **EventBridge** | Decouples import → matching → CRM sync. |

The Next.js app is deployable to AWS Amplify Hosting (SSR runs on Lambda). It needs `BEDROCK_MODEL_ID` and an IAM role with `bedrock:InvokeModel` for the assistant, and `HUBSPOT_ACCESS_TOKEN` for demo requests.

## Data provenance rules

These are enforced in code and schema, not only in the UI:

1. **NULL means not stated.** Delivery fee, minimum order, lead time and price are nullable. `0` is only stored when a supplier states "free" or "no minimum".
2. **Derived prices are labelled.** `case_price_basis` is `stated_case`, `derived_from_unit` (unit price × stated units per case) or `missing`; a CHECK constraint keeps it consistent with `case_price`.
3. **No guessing pack sizes.** A size in a product name ("Rolled Oats 1kg") is not treated as a case size unless a multiplier is stated.
4. **Ambiguous price columns block import** until a person chooses per case or per unit.
5. **Only people confirm matches.** `product_groups.decided_by` must be set for confirmed/rejected (CHECK constraint). AI reviews live in a separate table.
6. **Delivery dates are entered, never estimated.** `purchase_orders.confirmed_delivery_date` is user-entered from a supplier confirmation; the UI shows the supplier's stated lead time text alongside it.
7. **Totals with unstated terms are marked incomplete**, and plans that miss a minimum order are ranked below plans that meet it.
