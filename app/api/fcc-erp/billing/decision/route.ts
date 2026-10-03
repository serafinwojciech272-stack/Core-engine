import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const expected = process.env.FCC_INTERNAL_API_KEY;
  if (!expected || req.headers.get("x-fcc-internal-key") !== expected) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const invoiceId = body?.invoice_id;
  const decision = body?.decision;
  if (typeof invoiceId !== "string" || !["APPROVE", "REJECT"].includes(decision)) {
    return NextResponse.json({ error: "invoice_id and APPROVE/REJECT are required" }, { status: 400 });
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) return NextResponse.json({ error: "BILLING_BACKEND_NOT_CONFIGURED" }, { status: 503 });
  try {
    const r = await fetch(base + "/rest/v1/rpc/ce_fcc_decide_invoice", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_invoice_id: invoiceId, p_decision: decision, p_reason: body?.reason ?? null, p_actor_id: body?.actor_id ?? null }),
      cache: "no-store"
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: "DECISION_FAILED", detail: data }, { status: 422 });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "BILLING_BACKEND_UNAVAILABLE" }, { status: 503 });
  }
}
