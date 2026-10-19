# ShelfRelay

AI-native procurement intelligence for independent retailers and consumer-goods wholesalers: compare suppliers on true landed cost, consolidate catalogues, review product matches, plan replenishment and prepare purchase orders.

> All suppliers, products, prices, terms and store records in this repository are **fictional demonstration data**.

## Repository

| Path | What it is |
|---|---|
| [web/](web) | Next.js 15 app: public website (`/`, `/retailers`, `/wholesalers`, `/compare`, `/pricing`, `/demo`) and the workspace dashboard (`/app/*`) |
| [web/src/lib/engine](web/src/lib/engine) | Shared domain engine: extraction, pack-size parsing, matching, total-cost comparison, replenishment, explanations (unit tested) |
| [web/public/demo-catalogues](web/public/demo-catalogues) | Four fictional supplier catalogues in different formats plus a terms sheet |
| [services/](services) | AWS Lambda handlers: catalogue ingest, Textract completion, Bedrock match review, HubSpot sync |
| [infra/template.yaml](infra/template.yaml) | AWS SAM template: S3, Textract SNS, Aurora PostgreSQL Serverless v2, Lambda, EventBridge, VPC endpoints, DLQ |
| [db/schema.sql](db/schema.sql) | PostgreSQL schema with provenance constraints and row-level security |
| [docs/architecture.md](docs/architecture.md) | Architecture and data-provenance rules |
| [docs/hubspot-crm.md](docs/hubspot-crm.md) | HubSpot properties, pipelines and workflows |

## Run locally

```bash
npm --prefix web install
```

```bash
npm --prefix web run dev
```

Open http://localhost:3000 for the website and http://localhost:3000/app for the demo workspace. No AWS or HubSpot credentials are needed: the assistant gives rule-based answers (labelled as such) and demo requests are saved to `web/.data/`. See [web/.env.example](web/.env.example) to enable Bedrock and HubSpot.

```bash
npm --prefix web test
```

## Demo walkthrough

1. **Catalogue upload** (`/app/catalogues`): load the sample files. Northgate states case prices with a 5+ tier column; Harbor & Vine states unit prices (case price is derived and labelled); Meridian's `Price` column is unlabelled, so ShelfRelay asks whether it is per case or per unit; Fieldstone has `TBC` prices, a missing pack size and no terms.
2. **Matching review** (`/app/matching`): 8 high-confidence groups are proposed; 6 are flagged, e.g. Cola *Zero* vs *Original*, Oat drink *Barista* vs *Original*, 5kg vs 1kg rice, Fieldstone vs Vellore penne.
3. **Supplier comparison** (`/app/compare`): per-litre/kg/unit prices, case rounding and overbuy, tier prices, Harbor & Vine's minimum order and discount, Meridian's delivery fee, and the lowest-cost plan that meets every minimum, with a written explanation.
4. **Replenishment** (`/app/replenishment`): suggestions from 28 days of recorded sales with your safety and cover days; the peanut butter line has only 9 days of history and gets no recommendation.
5. **Purchase orders / tracking**: draft POs per supplier, CSV export, and status tracking where delivery dates are only ever entered from a supplier confirmation.

## Labels used everywhere

| Label | Meaning |
|---|---|
| Imported | Stated in a supplier catalogue or terms sheet, linked to file and row |
| User-set | Entered or confirmed by your team |
| Calculated | Computed by ShelfRelay from imported and user-set values |
| Estimate | Projected from recorded history (replenishment) |
| AI suggestion | Proposed by the matcher or Bedrock; requires review |

## Deploy the AWS backend

```bash
npm --prefix services install
```

```bash
npm --prefix services run build
```

```bash
sam deploy --guided --template-file infra/template.yaml
```

Then apply `db/schema.sql` to the Aurora cluster. The template creates a NAT gateway (for HubSpot egress) and Aurora Serverless v2, both of which incur cost.

## Not yet built

- Authentication and multi-tenant API for the workspace (the demo keeps state in the browser; the schema and Lambdas are ready for it).
- Presigned-upload API that writes `catalogue_documents` rows and S3 objects (the ingest Lambda expects that key layout).
- `HS_STAGE_*` onboarding stage IDs are read from the hubspot-sync environment but not yet template parameters.
- Sending POs by email; the app records that an order was sent and exports CSV.
