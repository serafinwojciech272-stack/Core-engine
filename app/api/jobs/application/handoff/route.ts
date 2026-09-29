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
    const body = await request.json() as { jobId?: string };
    if (!body.jobId) return NextResponse.json({ ok: false, error: "JOB_ID_REQUIRED" }, { status: 400 });

    const r = await requestSb("job_opportunities?id=eq." + encodeURIComponent(body.jobId) + "&select=id,status,url,title,source&limit=1");
    const rows = await r.json() as Array<{ id: string; status: string; url: string; title: string; source: string }>;
    const job = rows[0];
    if (!job) return NextResponse.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404 });
    if (job.status !== "APPROVED") return NextResponse.json({ ok: false, error: "HUMAN_APPROVAL_REQUIRED", status: job.status }, { status: 409 });

    await requestSb("job_opportunities?id=eq." + encodeURIComponent(body.jobId), { method: "PATCH", body: JSON.stringify({ status: "PROVIDER_HANDOFF" }) });
    await requestSb("job_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        job_id: body.jobId,
        event_type: "PROVIDER_HANDOFF",
        actor: "human",
        from_status: "APPROVED",
        to_status: "PROVIDER_HANDOFF",
        metadata: { provider: job.source, provider_url: job.url, automatic_submission: false }
      })
    });

    return NextResponse.json({ ok: true, status: "PROVIDER_HANDOFF", provider: job.source, providerUrl: job.url, automaticSubmission: false });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 503 });
  }
}
