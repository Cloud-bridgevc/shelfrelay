# HubSpot CRM plan

How ShelfRelay uses HubSpot for retailer prospects, wholesaler relationships,
demo requests and customer onboarding. The demo form ([web/src/app/api/demo-request/route.ts](../web/src/app/api/demo-request/route.ts))
and the `hubspot-sync` Lambda ([services/src/hubspot-sync.ts](../services/src/hubspot-sync.ts)) implement the parts marked **Built**.

## Principles

- **One contact per person, one company per business.** Contacts are upserted by email; companies by domain.
- **Two tracks, one CRM.** Every record carries `shelfrelay_crm_track` = `retailer_prospect` or `wholesaler_relationship`, so lists, workflows and reports split cleanly.
- **Usage signals, not customer data.** Product events sync timestamps and counts (last catalogue import, last PO sent). Supplier prices, order values and catalogue contents never go to HubSpot.
- **Consent is explicit.** `shelfrelay_marketing_opt_in` is only `true` when the box on the form is ticked; marketing workflows enrol on that property, never on form submission alone.

## Custom properties

| Object | Property (internal name) | Type | Values / notes |
|---|---|---|---|
| Contact, Deal, Company | `shelfrelay_crm_track` | Enumeration | `retailer_prospect`, `wholesaler_relationship` |
| Contact | `shelfrelay_business_type` | Enumeration | `independent_retailer`, `multi_store_retailer`, `wholesaler`, `distributor`, `other` |
| Contact | `shelfrelay_location_count` | Enumeration | `1`, `2–5`, `6–20`, `20+` |
| Contact | `shelfrelay_supplier_count` | Enumeration | `1`, `2–5`, `6–15`, `15+` |
| Contact | `shelfrelay_interests` | Multi-checkbox | Feature names from the form |
| Contact | `shelfrelay_plan_interest` | Single-line text | `starter`, `growth`, `wholesale` from `/demo?plan=` |
| Contact | `shelfrelay_marketing_opt_in` | Boolean | From the form checkbox |
| Company | `shelfrelay_workspace_id` | Single-line text | Organization ID in PostgreSQL |
| Company | `shelfrelay_last_catalogue_import` | Datetime | From `catalogue.imported` |
| Company | `shelfrelay_last_po_sent` | Datetime | From `purchase_order.sent` |
| Company | `shelfrelay_supplier_relationships` | Number | Count of suppliers in workspace (retailers) or retail accounts (wholesalers) |

## Pipelines

### 1. Demo requests (Deals) — **Built** (creation)

| Stage | Entered when | Automation |
|---|---|---|
| Requested | Form submitted | Deal created + associated to contact; owner rotated by track (retail team / wholesale team) |
| Scheduled | Meeting booked via HubSpot meetings link | Reminder email 24h before; prep task with the prospect's supplier count |
| Demo held | Owner marks complete | Follow-up email template by track within 1 business day |
| Trial / pilot | Workspace created for evaluation | Creates onboarding deal (pipeline 3) |
| Closed won / lost | Contract signed / declined | Won → onboarding pipeline; Lost → reason required, nurture list if opted in |

### 2. Wholesaler relationships (Deals, wholesaler track)

For wholesalers and distributors who publish catalogues to retail accounts.

| Stage | Meaning |
|---|---|
| Identified | Wholesaler named by one or more ShelfRelay retailers as a supplier |
| Contacted | Partnership outreach started |
| Catalogue shared | First structured catalogue published (`catalogue.imported` on a wholesaler workspace) |
| Active partner | Catalogue updated within the last 45 days |
| Dormant | No catalogue update for 90 days (workflow moves it automatically) |

Retailer demand is the signal here: the count of retailer workspaces listing a wholesaler is surfaced on the company record (`shelfrelay_supplier_relationships`) to prioritize outreach. Retailer identities are not shared with the wholesaler without consent.

### 3. Customer onboarding (Deals) — **Built** (stage sync)

Driven by product events through `account.onboarding_stage_changed`; nobody moves these by hand.

| Stage | Product event | Customer success action |
|---|---|---|
| Contract signed | Deal closed won | Welcome email; kickoff call task |
| Workspace created | Organization row created | Send upload guide (CSV export tips by common POS / supplier portals) |
| First catalogue imported | First `catalogue.imported` | If none after 5 days → CSM task "help with first upload" |
| Matches reviewed | Review queue first cleared | Share comparison walkthrough video |
| First PO sent | First `purchase_order.sent` | Check-in call; ask for second location / suppliers |
| Live | 3 POs in 30 days | Hand over from onboarding to account management |

## Workflows

1. **Demo request routing** — Trigger: deal created in *Demo requests*. Branch on `shelfrelay_crm_track` → rotate owner within team → send confirmation email → create "Prepare demo" task due in 1 business day.
2. **Wholesaler interest from retailers** — Trigger: company `shelfrelay_supplier_relationships` ≥ 3 and no open wholesaler-relationship deal → create deal at *Identified*, assign wholesale team.
3. **Onboarding stalls** — Trigger: onboarding deal in the same stage > 7 days → task for CSM + internal Slack notification.
4. **Dormant partner** — Trigger: `shelfrelay_last_catalogue_import` more than 90 days ago on an *Active partner* → move to *Dormant*, task to reach out.
5. **Nurture (opt-in only)** — Trigger: `shelfrelay_marketing_opt_in = true` AND demo deal closed lost → monthly product update sequence by track.

## Integration architecture

```
Website demo form ──► Next.js /api/demo-request ──► HubSpot (contacts batch upsert + deal)
                                                    (local .data/ file in development)

Product events ──► EventBridge bus ──► hubspot-sync Lambda ──► HubSpot CRM v3
  demo.requested                         │
  account.onboarding_stage_changed       └─► crm_sync_events (audit log, retries, DLQ)
  catalogue.imported
  purchase_order.sent
```

- Auth: HubSpot **private app** token stored in Secrets Manager (`{"accessToken": "..."}`), scopes `crm.objects.contacts.write`, `crm.objects.companies.write`, `crm.objects.deals.write`.
- Rate limits: 429 responses back off exponentially; EventBridge retries up to 8 times then sends to the DLQ, which raises a CloudWatch alarm.
- Idempotency: contacts upsert by email; deals store `shelfrelay_workspace_id` so a replayed event updates rather than duplicates (add a search-before-create when enabling replay).

## Setup checklist

1. Create the custom properties above (Settings → Properties) with the exact internal names.
2. Create the three deal pipelines; copy pipeline and stage IDs into the SAM parameters / environment (`HUBSPOT_DEMO_PIPELINE_ID`, `HUBSPOT_DEMO_STAGE_ID`, `HS_STAGE_*`).
3. Create a private app with the scopes listed; store its token in Secrets Manager and in `HUBSPOT_ACCESS_TOKEN` for the web app.
4. Build the five workflows; test each with a contact on a test domain before enabling.
