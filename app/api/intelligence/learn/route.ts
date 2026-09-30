import { NextResponse } from "next/server";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { storageMode, listPersistedMissions, listPersistedEvents, type EngineEventRow } from "@/lib/storage";
import { tenantMissionIds } from "@/lib/commercial-storage";
import { buildMissionReport, type ReportEvent } from "@/lib/mission-report";
import { buildLessonCandidate, validateAndPromoteLesson } from "@/lib/learning-promotion";

function toReportEvent(event: EngineEventRow): ReportEvent {
  return {
    id: event.id,
    missionId: event.missionId,
    eventType: event.eventType,
    createdAt: event.createdAt,
    metadata: event.metadata,
    decisionId: event.decisionId ?? undefined,
    fromState: event.fromState ?? undefined,
    toState: event.toState ?? undefined,
    actorType: event.actorType
  };
}

export async function POST(request: Request) {
  const runtime = await resolveSaaSContext(request);
  const tenant = runtime.identity ? { tenantId: runtime.identity.tenantId } : runtime.legacyTenant;
  if (!tenant) return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });
  if (storageMode() !== "supabase") {
    return NextResponse.json({ ok: false, error: "LEARNING_REQUIRES_SUPABASE" }, { status: 409 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = typeof body?.missionId === "string" ? body.missionId : "";
    if (!missionId) return NextResponse.json({ ok: false, error: "MISSION_ID_REQUIRED" }, { status: 400 });

    const ids = new Set(await tenantMissionIds(tenant.tenantId));
    if (!ids.has(missionId)) return NextResponse.json({ ok: false, error: "MISSION_NOT_FOUND" }, { status: 404 });

    const [missions, events] = await Promise.all([
      listPersistedMissions(100),
      listPersistedEvents(500)
    ]);
    const mission = missions.find(item => item.id === missionId);
    if (!mission) return NextResponse.json({ ok: false, error: "MISSION_NOT_FOUND" }, { status: 404 });

    const report = buildMissionReport({
      mission,
      events: events.map(toReportEvent),
      tenantId: tenant.tenantId
    });

    const lessons = report.summary.whatItLearned.filter(Boolean);
    if (!lessons.length) {
      return NextResponse.json({
        ok: true,
        version: "M10.6",
        promoted: false,
        reason: "NO_LESSON_CANDIDATE",
        report
      });
    }

    const results = [];
    for (const lesson of lessons.slice(0, 6)) {
      const candidate = buildLessonCandidate({
        lesson,
        quality: report.outcome.quality,
        domain: typeof body?.domain === "string" ? body.domain : undefined,
        missionId,
        provenance: {
          missionId,
          reportQuality: report.outcome.quality,
          outcome: report.outcome,
          evidenceRefs: report.evidence.evidenceRefs
        }
      });

      const experienceRows = await fetchExperiences(tenant.tenantId, candidate.lesson);
      results.push(await validateAndPromoteLesson({
        tenantId: tenant.tenantId,
        candidate,
        experiences: experienceRows
      }));
    }

    return NextResponse.json({
      ok: true,
      version: "M10.6",
      missionId,
      report,
      results,
      promoted: results.some(result => result.validation.status === "PROMOTED"),
      trace: results.map(result => ({
        stage: result.validation.status === "PROMOTED" ? "KNOWLEDGE_PROMOTION" : "LESSON_VALIDATION",
        status: "COMPLETE",
        candidateKey: result.candidate.candidateKey,
        evidenceCount: result.validation.evidenceCount,
        confidence: result.validation.confidence
      }))
    });
  } catch (error) {
    console.error("[core-engine] M10.6 learning promotion failed", error);
    return NextResponse.json({ ok: false, error: "LEARNING_PROMOTION_FAILED" }, { status: 503 });
  }
}

async function fetchExperiences(tenantId: string, lesson: string) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/ce_intelligence_experiences`);
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  url.searchParams.set("tenant_id", `eq.${tenantId}`);
  url.searchParams.set("select", "id,mission_id,outcome_quality,success,extracted_lessons");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("LEARNING_EXPERIENCES_READ_FAILED");
  return await response.json() as Array<{
    id: string;
    mission_id?: string | null;
    outcome_quality?: "VERIFIED" | "NEGATIVE" | "UNVERIFIED";
    success?: boolean | null;
    extracted_lessons?: unknown;
  }>;
}
