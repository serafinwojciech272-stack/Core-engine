import { NextResponse } from "next/server";
import { validateJobOpportunity } from "@/lib/job-quality";

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
    headers: {
      apikey: c.key,
      Authorization: "Bearer " + c.key,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  if (!r.ok) throw new Error("SUPABASE_" + r.status);
  return r;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { jobId?: string };
    if (!body.jobId) {
      return NextResponse.json({ ok: false, error: "JOB_ID_REQUIRED" }, { status: 400 });
    }

    const jobRes = await requestSb(
      "job_opportunities?id=eq." + encodeURIComponent(body.jobId) +
      "&select=id,status,title,url,source,company,location,description&limit=1"
    );
    const jobs = await jobRes.json() as Array<{
      id: string;
      status: string | null;
      title: string;
      url: string;
      source: string;
      company: string | null;
      location: string | null;
      description: string | null;
    }>;
    const job = jobs[0];
    if (!job) {
      return NextResponse.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404 });
    }

    const terminal = new Set(["APPLIED", "RESPONDED", "INTERVIEW", "OFFER", "WITHDRAWN"]);
    if (terminal.has(job.status || "")) {
      return NextResponse.json(
        { ok: false, error: "APPLICATION_ALREADY_PROGRESSING", status: job.status },
        { status: 409 }
      );
    }

    if (!["NEW", "REVIEW"].includes(job.status || "")) {
      return NextResponse.json(
        { ok: false, error: "INVALID_APPROVAL_STATE", status: job.status },
        { status: 409 }
      );
    }

    const quality = validateJobOpportunity({
      source: job.source,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description
    });
    if (!quality.valid) {
      return NextResponse.json(
        { ok: false, error: "JOB_QUALITY_GATE_FAILED", reason: quality.reason },
        { status: 409 }
      );
    }

    const preparedRes = await requestSb(
      "job_events?job_id=eq." + encodeURIComponent(body.jobId) +
      "&event_type=eq.APPLICATION_PREPARED&select=id,created_at&order=created_at.desc&limit=1"
    );
    const prepared = await preparedRes.json() as Array<{ id: string; created_at: string }>;
    if (!prepared[0]) {
      return NextResponse.json(
        { ok: false, error: "APPLICATION_PREPARATION_REQUIRED" },
        { status: 409 }
      );
    }

    const preparedAt = Date.parse(prepared[0].created_at);
    if (!Number.isFinite(preparedAt) || Date.now() - preparedAt > 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { ok: false, error: "APPLICATION_PREPARATION_EXPIRED" },
        { status: 409 }
      );
    }

    await requestSb(
      "job_opportunities?id=eq." + encodeURIComponent(body.jobId),
      { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) }
    );

    await requestSb("job_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        job_id: body.jobId,
        event_type: "APPLICATION_APPROVED",
        actor: "human",
        from_status: job.status,
        to_status: "APPROVED",
        metadata: {
          approval_required: true,
          automatic_submission: false,
          preparation_event_id: prepared[0].id,
          quality_gate: quality.reason
        }
      })
    });

    return NextResponse.json({
      ok: true,
      jobId: body.jobId,
      status: "APPROVED",
      providerUrl: job.url
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 503 });
  }
}
