import { buildMissionReport, type ReportEvent } from "@/lib/mission-report";
import { buildLessonCandidate, validateAndPromoteLesson } from "@/lib/learning-promotion";
import { buildLearningLesson } from "@/lib/learning-engine";
import { recordIntelligenceExperience } from "@/lib/intelligence-core";
import { listPersistedEvents, listPersistedMissions, type EngineEventRow, storageMode } from "@/lib/storage";

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

async function fetchExperiences(tenantId: string) {
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

export async function runMissionLearningLoop(input: {
  tenantId: string;
  missionId: string;
  domain?: string;
}) {
  if (storageMode() !== "supabase") {
    return {
      version: "M10.7",
      mode: "NON_DURABLE",
      promoted: false,
      reason: "LEARNING_REQUIRES_SUPABASE",
      results: []
    };
  }

  const [missions, events] = await Promise.all([
    listPersistedMissions(100),
    listPersistedEvents(500)
  ]);
  const mission = missions.find(item => item.id === input.missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");

  const report = buildMissionReport({
    mission,
    events: events.map(toReportEvent),
    tenantId: input.tenantId
  });
  const lessons = report.summary.whatItLearned.filter(Boolean).slice(0, 6);
  const generatedLesson = buildLearningLesson(
    { quality: report.outcome.quality, improved: report.outcome.quality === "VERIFIED" ? true : report.outcome.quality === "NEGATIVE" ? false : null,
      delta: report.outcome.delta ?? null, deltaPct: report.outcome.deltaPct ?? null,
      reason: report.outcome.quality === "VERIFIED" ? "Mission outcome verified." : report.outcome.quality === "NEGATIVE" ? "Mission outcome was negative." : "Mission outcome remains unverified." },
    { missionObjective: mission.objective, kpi: mission.kpi }
  );
  if (report.outcome.quality !== "UNVERIFIED") {
    await recordIntelligenceExperience({
      tenantId: input.tenantId,
      missionId: input.missionId,
      problem: mission.objective,
      decision: report.summary.whyMissionSelected,
      action: report.summary.whatActionItTook.join(", ").slice(0, 4000),
      expectedOutcome: { predicted: report.outcome.predicted, kpi: mission.kpi },
      actualOutcome: { actual: report.outcome.actual, delta: report.outcome.delta, deltaPct: report.outcome.deltaPct, quality: report.outcome.quality },
      outcomeQuality: report.outcome.quality,
      delta: report.outcome.delta ?? null,
      deltaPct: report.outcome.deltaPct ?? null,
      success: report.outcome.quality === "VERIFIED",
      extractedLessons: [generatedLesson.lesson],
      strategyCandidates: [report.summary.nextAction],
      confidence: report.outcome.quality === "VERIFIED" ? 0.8 : 0.5
    });
  }
  const experiences = await fetchExperiences(input.tenantId);
  const effectiveLessons = lessons.length ? lessons : [generatedLesson.lesson];
  if (!effectiveLessons.length) {
    return {
      version: "M10.7",
      mode: "DURABLE",
      promoted: false,
      reason: "NO_LESSON_CANDIDATE",
      report,
      results: []
    };
  }

  const results = [];
  for (const lesson of effectiveLessons) {
    const candidate = buildLessonCandidate({
      lesson,
      quality: report.outcome.quality,
      domain: input.domain,
      missionId: input.missionId,
      provenance: {
        source: "MISSION_OUTCOME",
        version: "M10.7",
        missionId: input.missionId,
        outcome: report.outcome,
        evidenceRefs: report.evidence.evidenceRefs
      }
    });
    results.push(await validateAndPromoteLesson({
      tenantId: input.tenantId,
      candidate,
      experiences
    }));
  }

  return {
    version: "M10.7",
    mode: "DURABLE",
    promoted: results.some(result => result.validation.status === "PROMOTED"),
    report,
    results
  };
}
