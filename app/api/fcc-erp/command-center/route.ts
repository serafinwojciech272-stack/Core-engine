import { NextResponse } from "next/server";

const FALLBACK = {
  tenant_name: "FCC Zabrze",
  open_cases: 0,
  open_invoices: 0,
  open_anomalies: 0,
  pending_approvals: 0,
  ksef_in_flight: 0,
  ar_outstanding: 0,
  ar_overdue: 0,
  ap_outstanding: 0,
  ap_overdue: 0,
  source: "fallback",
  checked_at: new Date().toISOString()
};

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const tenantId = process.env.FCC_TENANT_ID || "d94cfdf2-c4f1-4f93-b6ae-4c25350b41aa";
  if (!base || !key) return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "no-store" } });

  try {
    const response = await fetch(
      base + "/rest/v1/ce_erp_command_center?tenant_id=eq." + encodeURIComponent(tenantId) + "&select=*",
      { headers: { apikey: key, Authorization: "Bearer " + key }, cache: "no-store" }
    );
    if (!response.ok) throw new Error("Supabase HTTP " + response.status);
    const rows = await response.json();
    const row = rows[0];
    if (!row) throw new Error("FCC tenant not found");
    return NextResponse.json({ ...row, source: "live", checked_at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "no-store" } });
  }
}
