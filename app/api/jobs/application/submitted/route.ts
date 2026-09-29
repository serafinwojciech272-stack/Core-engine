import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return { url, key };
}

async function requestSb(path: string, init: RequestInit = {}) {
  const c = await sb();
  const r = await fetch(c.url + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: c.key, Authorization: "Bearer " + c.key, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store"
  });
  if (!r.ok) throw new Error("SUPABASE_" + r.status);
  return r;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { jobId?: string; confirmation?: boolean; externalId?: string };
    if (!body.jobId) return NextResponse.json({ ok: false, error: "JOB_ID_REQUIRED" }, { status: 400 });
    if (body.confirmation !== true) return NextResponse.json({ ok: false, error: "SUBMISSION_CONFIRMATION_REQUIRED" }, { status: 400 });

    const r = await requestSb("job_opportunities?id=eq." + encodeURIComponent(body.jobId) + "&select=id,status,url&limit=1");
    const rows = await r.json() as Array<{ id: string; status: string; url: string }>;
    const job = rows[0];
    if (!job) return NextResponse.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404 });
    if (job.status !== "PROVIDER_HANDOFF") return NextResponse.json({ ok: false, error: "PROVIDER_HANDOFF_REQUIRED", status: job.status }, { status: 409 });

    await requestSb("job_opportunities?id=eq." + encodeURIComponent(body.jobId), { method: "PATCH", body: JSON.stringify({ status: "APPLIED" }) });
    await requestSb("job_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        job_id: body.jobId,
        event_type: "APPLICATION_SUBMITTED",
        actor: "human",
        from_status: "PROVIDER_HANDOFF",
        to_status: "APPLIED",
        metadata: { external_id: body.externalId || null, provider_url: job.url, automatic_submission: false, confirmation: true }
      })
    });

    return NextResponse.json({ ok: true, status: "APPLIED", jobId: body.jobId, externalId: body.externalId || null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 503 });
  }
}
