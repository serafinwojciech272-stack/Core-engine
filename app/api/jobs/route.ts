import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function sb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return { url, key };
}

async function get(path: string) {
  const c = await sb();
  const r = await fetch(c.url + "/rest/v1/" + path, {
    headers: { apikey: c.key, Authorization: "Bearer " + c.key },
    cache: "no-store"
  });
  if (!r.ok) throw new Error("SUPABASE_" + r.status);
  return r.json();
}

export async function GET() {
  try {
    const [jobs, syncRuns] = await Promise.all([
      get("job_opportunities?select=id,source,url,title,company,location,salary,published_at,discovered_at,match_score,decision,status&order=match_score.desc,discovered_at.desc&limit=100"),
      get("job_sync_runs?select=id,started_at,finished_at,discovered,inserted,errors,status&order=started_at.desc&limit=1")
    ]);

    const latestSync = Array.isArray(syncRuns) ? syncRuns[0] ?? null : null;
    return NextResponse.json({
      ok: true,
      jobs,
      latestSync,
      pipeline: {
        total: Array.isArray(jobs) ? jobs.length : 0,
        highMatch: Array.isArray(jobs) ? jobs.filter((j: { match_score?: number | null }) => Number(j.match_score ?? 0) >= 75).length : 0,
        review: Array.isArray(jobs) ? jobs.filter((j: { decision?: string | null }) => j.decision === "REVIEW").length : 0
      }
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
