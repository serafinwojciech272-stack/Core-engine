import { safeEqual } from "@/lib/http";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const expected = process.env.FCC_INTERNAL_API_KEY;
  if (!expected || !safeEqual(request.headers.get("x-fcc-internal-key") || "", expected)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.invoice_id || !["APPROVE", "REJECT"].includes(body.decision)) {
    return NextResponse.json(
      { error: "invoice_id and decision(APPROVE|REJECT) are required" },
      { status: 400 },
    );
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return NextResponse.json({ error: "SUPABASE_SERVER_CONFIG_MISSING" }, { status: 503 });
  }

  const response = await fetch(
    `${base}/rest/v1/rpc/ce_fcc_decide_invoice`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_invoice_id: body.invoice_id,
        p_decision: body.decision,
        p_reason: body.reason ?? null,
        p_actor_id: body.actor_id ?? null,
      }),
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.message ?? payload?.error ?? "BILLING_APPROVAL_FAILED", details: payload },
      { status: 422 },
    );
  }

  return NextResponse.json(payload, { status: 200 });
}
