import { NextResponse } from "next/server";
import { prepareApplication } from "@/lib/application-engine";

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
    const body = await request.json();
    if (!body?.url || !String(body.url).startsWith("http")) {
      return NextResponse.json({ ok: false, error: "INVALID_JOB_URL" }, { status: 400 });
    }

    const application = prepareApplication({
      title: String(body.title || "Selected position"),
      company: body.company ? String(body.company) : null,
      location: body.location ? String(body.location) : null,
      description: body.description ? String(body.description) : null,
      url: String(body.url),
      matchScore: typeof body.matchScore === "number" ? body.matchScore : null,
      decision: body.decision ? String(body.decision) : null
    });

    let eventPersisted = false;
    const jobId = body.jobId ? String(body.jobId) : null;

    if (jobId) {
      try {
        await requestSb("job_events", {
          method: "POST",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({
            job_id: jobId,
            event_type: "APPLICATION_PREPARED",
            actor: "core_engine",
            from_status: body.status ? String(body.status) : null,
            to_status: body.status ? String(body.status) : null,
            metadata: {
              mode: application.mode,
              approval_required: application.approvalRequired,
              automatic_submission: application.submission.automaticSubmission,
              match_score: application.match.score,
              decision: application.match.decision,
              role_families: application.match.roleFamilies,
              risks: application.match.risks
            }
          })
        });
        eventPersisted = true;
      } catch {
        // Preparation remains available when event persistence is temporarily unavailable.
      }
    }

    return NextResponse.json({
      ok: true,
      application,
      persistence: { eventPersisted, jobId }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
