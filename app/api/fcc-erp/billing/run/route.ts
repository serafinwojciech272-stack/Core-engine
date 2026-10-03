import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const expected = process.env.FCC_INTERNAL_API_KEY;
  const supplied = req.headers.get("x-fcc-internal-key");
  if (!expected || supplied !== expected) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const serviceEventId = body?.service_event_id;
  if (typeof serviceEventId !== "string" || !serviceEventId) {
    return NextResponse.json({ error: "service_event_id is required" }, { status: 400 });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) {
    return NextResponse.json({ error: "BILLING_BACKEND_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const response = await fetch(base + "/rest/v1/rpc/ce_fcc_run_billing_for_event", {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_service_event_id: serviceEventId }),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: "BILLING_EXECUTION_FAILED", detail: data }, { status: 422 });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "BILLING_BACKEND_UNAVAILABLE" }, { status: 503 });
  }
}
