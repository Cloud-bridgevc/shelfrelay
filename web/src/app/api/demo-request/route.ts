import { NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { hubspotConfigured, submitDemoRequest, type DemoRequest } from "@/lib/hubspot";

const BUSINESS_TYPES = ["independent_retailer", "multi_store_retailer", "wholesaler", "distributor", "other"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(v: unknown, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real users never see or fill this field.
  if (str(body.website)) return NextResponse.json({ ok: true, crm: "skipped" });

  const r: DemoRequest = {
    firstName: str(body.firstName, 80),
    lastName: str(body.lastName, 80),
    email: str(body.email, 160).toLowerCase(),
    company: str(body.company, 160),
    role: str(body.role, 120),
    businessType: (BUSINESS_TYPES as readonly string[]).includes(str(body.businessType)) ? (str(body.businessType) as DemoRequest["businessType"]) : "other",
    locations: str(body.locations, 20),
    supplierCount: str(body.supplierCount, 20),
    interests: Array.isArray(body.interests) ? body.interests.map((x) => str(x, 60)).filter(Boolean).slice(0, 10) : [],
    message: str(body.message, 2000),
    plan: str(body.plan, 40),
    marketingOptIn: body.marketingOptIn === true,
  };

  const errors: Record<string, string> = {};
  if (!r.firstName) errors.firstName = "Enter your first name.";
  if (!r.lastName) errors.lastName = "Enter your last name.";
  if (!EMAIL_RE.test(r.email)) errors.email = "Enter a valid work email.";
  if (!r.company) errors.company = "Enter your company name.";
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  if (hubspotConfigured()) {
    try {
      await submitDemoRequest(r);
      return NextResponse.json({ ok: true, crm: "hubspot" });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ ok: false, error: "We couldn't submit your request. Please try again shortly." }, { status: 502 });
    }
  }

  // Development fallback: keep the request locally so nothing is lost.
  if (process.env.NODE_ENV !== "production") {
    const dir = path.join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "demo-requests.jsonl"), JSON.stringify({ ...r, receivedAt: new Date().toISOString() }) + "\n");
    return NextResponse.json({ ok: true, crm: "local" });
  }
  return NextResponse.json({ ok: false, error: "Demo requests are not configured yet." }, { status: 503 });
}
