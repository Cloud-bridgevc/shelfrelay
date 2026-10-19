import type { EventBridgeEvent } from "aws-lambda";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { db } from "./lib/db";

/**
 * Mirrors product events into HubSpot. The pipelines, stages and custom
 * properties referenced here are defined in docs/hubspot-crm.md.
 *
 * Product events → CRM:
 *   demo.requested                    → contact upsert + deal in "Demo requests"
 *   account.onboarding_stage_changed  → deal stage in "Customer onboarding"
 *   catalogue.imported                → company activity properties (engagement signal)
 *   purchase_order.sent               → company "last PO sent" (usage signal, no order values)
 */

type Detail = Record<string, unknown>;
const API = "https://api.hubapi.com";
let token: string | undefined;

async function hubspotToken() {
  if (token) return token;
  const sm = new SecretsManagerClient({});
  const s = await sm.send(new GetSecretValueCommand({ SecretId: process.env.HUBSPOT_SECRET_ARN! }));
  token = JSON.parse(s.SecretString!).accessToken as string;
  return token;
}

async function hs<T = unknown>(method: "POST" | "PATCH", path: string, body: unknown, attempt = 1): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await hubspotToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return hs(method, path, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`HubSpot ${method} ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const ONBOARDING_STAGES: Record<string, string | undefined> = {
  contract_signed: process.env.HS_STAGE_CONTRACT_SIGNED,
  workspace_created: process.env.HS_STAGE_WORKSPACE_CREATED,
  first_catalogue_imported: process.env.HS_STAGE_FIRST_CATALOGUE,
  matches_reviewed: process.env.HS_STAGE_MATCHES_REVIEWED,
  first_po_sent: process.env.HS_STAGE_FIRST_PO,
  live: process.env.HS_STAGE_LIVE,
};

export async function handler(event: EventBridgeEvent<string, Detail>) {
  const pool = await db();
  const log = await pool.query<{ id: string }>(
    "INSERT INTO crm_sync_events (event_type, payload, status) VALUES ($1, $2, 'pending') RETURNING id",
    [event["detail-type"], JSON.stringify(event.detail)],
  );
  try {
    const ids = await route(event["detail-type"], event.detail);
    await pool.query("UPDATE crm_sync_events SET status = 'sent', hubspot_ids = $2 WHERE id = $1", [log.rows[0].id, JSON.stringify(ids)]);
  } catch (e) {
    await pool.query("UPDATE crm_sync_events SET status = 'failed', error = $2 WHERE id = $1", [log.rows[0].id, String(e)]);
    throw e; // let EventBridge retry / DLQ
  }
}

async function route(type: string, d: Detail): Promise<Record<string, string>> {
  switch (type) {
    case "demo.requested": {
      const track = d.businessType === "wholesaler" || d.businessType === "distributor" ? "wholesaler_relationship" : "retailer_prospect";
      const contact = await hs<{ results: { id: string }[] }>("POST", "/crm/v3/objects/contacts/batch/upsert", {
        inputs: [
          {
            idProperty: "email",
            id: d.email,
            properties: {
              email: d.email,
              firstname: d.firstName,
              lastname: d.lastName,
              company: d.company,
              jobtitle: d.role ?? "",
              lifecyclestage: "lead",
              shelfrelay_business_type: d.businessType,
              shelfrelay_crm_track: track,
            },
          },
        ],
      });
      const deal = await hs<{ id: string }>("POST", "/crm/v3/objects/deals", {
        properties: {
          dealname: `Demo — ${d.company}`,
          pipeline: process.env.HS_DEMO_PIPELINE_ID,
          dealstage: process.env.HS_DEMO_STAGE_REQUESTED,
          shelfrelay_crm_track: track,
        },
        associations: [{ to: { id: contact.results[0].id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
      });
      return { contactId: contact.results[0].id, dealId: deal.id };
    }
    case "account.onboarding_stage_changed": {
      const stage = ONBOARDING_STAGES[String(d.stage)];
      if (!stage || !d.hubspotDealId) throw new Error(`Unmapped onboarding stage ${String(d.stage)}`);
      await hs("PATCH", `/crm/v3/objects/deals/${d.hubspotDealId}`, { properties: { dealstage: stage } });
      return { dealId: String(d.hubspotDealId) };
    }
    case "catalogue.imported":
    case "purchase_order.sent": {
      if (!d.hubspotCompanyId) return {};
      const now = new Date().toISOString();
      const props = type === "catalogue.imported" ? { shelfrelay_last_catalogue_import: now } : { shelfrelay_last_po_sent: now };
      await hs("PATCH", `/crm/v3/objects/companies/${d.hubspotCompanyId}`, { properties: props });
      return { companyId: String(d.hubspotCompanyId) };
    }
    default:
      return {};
  }
}
