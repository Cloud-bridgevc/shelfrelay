import "server-only";

/**
 * Minimal HubSpot CRM client for demo requests. See docs/hubspot-crm.md for
 * the full property, pipeline and workflow plan this maps onto.
 *
 * Requires HUBSPOT_ACCESS_TOKEN (private app token with crm.objects.contacts.write
 * and crm.objects.deals.write). HUBSPOT_DEMO_PIPELINE_ID / HUBSPOT_DEMO_STAGE_ID
 * select the "Demo requests" pipeline.
 */

export interface DemoRequest {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  role: string;
  businessType: "independent_retailer" | "multi_store_retailer" | "wholesaler" | "distributor" | "other";
  locations?: string;
  supplierCount?: string;
  interests: string[];
  message?: string;
  plan?: string;
  marketingOptIn: boolean;
}

const API = "https://api.hubapi.com";

/** Retailer prospects and wholesaler relationships follow different CRM tracks. */
export function crmTrack(t: DemoRequest["businessType"]) {
  return t === "wholesaler" || t === "distributor" ? "wholesaler_relationship" : "retailer_prospect";
}

export function hubspotConfigured() {
  return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
}

async function hs<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HubSpot ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function submitDemoRequest(r: DemoRequest): Promise<{ contactId: string; dealId: string }> {
  const track = crmTrack(r.businessType);
  const upsert = await hs<{ results: { id: string }[] }>("/crm/v3/objects/contacts/batch/upsert", {
    inputs: [
      {
        idProperty: "email",
        id: r.email,
        properties: {
          email: r.email,
          firstname: r.firstName,
          lastname: r.lastName,
          company: r.company,
          jobtitle: r.role,
          lifecyclestage: "lead",
          shelfrelay_business_type: r.businessType,
          shelfrelay_crm_track: track,
          shelfrelay_location_count: r.locations ?? "",
          shelfrelay_supplier_count: r.supplierCount ?? "",
          shelfrelay_interests: r.interests.join(";"),
          shelfrelay_plan_interest: r.plan ?? "",
          shelfrelay_marketing_opt_in: String(r.marketingOptIn),
        },
      },
    ],
  });
  const contactId = upsert.results[0].id;

  const deal = await hs<{ id: string }>("/crm/v3/objects/deals", {
    properties: {
      dealname: `Demo — ${r.company}`,
      pipeline: process.env.HUBSPOT_DEMO_PIPELINE_ID ?? "default",
      dealstage: process.env.HUBSPOT_DEMO_STAGE_ID ?? "appointmentscheduled",
      shelfrelay_crm_track: track,
      description: r.message ?? "",
    },
    // 3 = HubSpot-defined deal → contact association.
    associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
  });
  return { contactId, dealId: deal.id };
}
