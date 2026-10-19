import { NextResponse } from "next/server";
import { answer, type AssistantRequest } from "@/lib/assistant";

export async function POST(req: Request) {
  let body: AssistantRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 1000) {
    return NextResponse.json({ error: "Ask a question (up to 1000 characters)." }, { status: 422 });
  }
  if (!Array.isArray(body.suppliers) || !Array.isArray(body.items) || !Array.isArray(body.groups)) {
    return NextResponse.json({ error: "Workspace context missing." }, { status: 422 });
  }
  return NextResponse.json(await answer({ ...body, basket: body.basket ?? {} }));
}
