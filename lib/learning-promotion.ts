import { storeIntelligenceMemory } from "@/lib/intelligence-core";

export type LearningQuality = "VERIFIED" | "NEGATIVE" | "UNVERIFIED";
export type LessonStatus = "CANDIDATE" | "PROMOTED" | "REJECTED" | "STALE";

export type LessonCandidate = {
  candidateKey: string;
  lesson: string;
  domain?: string;
  quality: LearningQuality;
  missionId?: string;
  provenance: Record<string, unknown>;
};

export type LessonValidation = {
  evidenceCount: number;
  supportCount: number;
  contradictionCount: number;
  confidence: number;
  status: LessonStatus;
  rationale: string[];
};

export function normalizeLesson(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s%+.-]/gu, "").slice(0, 500);
}

export function candidateKey(lesson: string, domain?: string) {
  const base = normalizeLesson(lesson);
  return [domain ?? "global", base].join("::").slice(0, 700);
}

export function buildLessonCandidate(input: {
  lesson: string;
  quality: LearningQuality;
  domain?: string;
  missionId?: string;
  provenance?: Record<string, unknown>;
}): LessonCandidate {
  const lesson = input.lesson.trim().slice(0, 4000);
  return {
    candidateKey: candidateKey(lesson, input.domain),
    lesson,
    domain: input.domain,
    quality: input.quality,
    missionId: input.missionId,
    provenance: input.provenance ?? {}
  };
}

export function validateLessonCandidate(input: {
  candidate: LessonCandidate;
  experiences: Array<{
    id: string;
    mission_id?: string | null;
    outcome_quality?: LearningQuality;
    success?: boolean | null;
    extracted_lessons?: unknown;
  }>;
}): LessonValidation {
  const target = normalizeLesson(input.candidate.lesson);
  let supportCount = input.candidate.quality === "VERIFIED" ? 1 : 0;
  let contradictionCount = input.candidate.quality === "NEGATIVE" ? 1 : 0;
  const rationale: string[] = [];

  for (const experience of input.experiences) {
    const lessons = Array.isArray(experience.extracted_lessons) ? experience.extracted_lessons : [];
    const related = lessons.some(item => {
      if (typeof item !== "string") return false;
      const normalized = normalizeLesson(item);
      return normalized === target || normalized.includes(target) || target.includes(normalized);
    });
    if (!related) continue;
    if (experience.outcome_quality === "VERIFIED" || experience.success === true) supportCount++;
    if (experience.outcome_quality === "NEGATIVE" || experience.success === false) contradictionCount++;
  }

  const evidenceCount = supportCount + contradictionCount;
  const confidence = Math.max(0, Math.min(1,
    0.45 + supportCount * 0.15 - contradictionCount * 0.18
  ));
  let status: LessonStatus = "CANDIDATE";
  if (supportCount >= 2 && confidence >= 0.70 && supportCount > contradictionCount) status = "PROMOTED";
  else if (contradictionCount >= 2 && contradictionCount > supportCount) status = "REJECTED";

  if (status === "PROMOTED") rationale.push("At least two independently observed supporting outcomes and confidence threshold reached.");
  else if (status === "REJECTED") rationale.push("Negative evidence outweighs supporting evidence.");
  else rationale.push("Evidence is insufficient for knowledge promotion.");

  return { evidenceCount, supportCount, contradictionCount, confidence, status, rationale };
}

type DbConfig = { url: string; key: string };
function cfg(): DbConfig {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return { url, key };
}
function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
async function db(path: string, init: RequestInit = {}) {
  const c = cfg();
  const response = await fetch(`${c.url}/rest/v1/${path}`, {
    ...init, cache: "no-store", headers: { ...headers(c.key), ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`LEARNING_DB_${response.status}`);
  return response;
}

export async function promoteValidatedLesson(input: {
  tenantId: string;
  candidate: LessonCandidate;
  validation: LessonValidation;
  experienceIds?: string[];
  missionIds?: string[];
}) {
  const c = cfg();
  const now = new Date().toISOString();
  const lookup = new URL(`${c.url}/rest/v1/ce_intelligence_lessons`);
  lookup.searchParams.set("tenant_id", `eq.${input.tenantId}`);
  lookup.searchParams.set("candidate_key", `eq.${input.candidate.candidateKey}`);
  lookup.searchParams.set("select", "*");
  lookup.searchParams.set("limit", "1");
  const existingResponse = await fetch(lookup, { headers: headers(c.key), cache: "no-store" });
  if (!existingResponse.ok) throw new Error("LEARNING_CANDIDATE_LOOKUP_FAILED");
  const existingRows = await existingResponse.json() as Array<Record<string, unknown>>;
  const existing = existingRows[0];

  const existingExperienceIds = Array.isArray(existing?.source_experience_ids) ? existing.source_experience_ids : [];
  const existingMissionIds = Array.isArray(existing?.source_mission_ids) ? existing.source_mission_ids : [];
  const experienceIds = [...new Set([...existingExperienceIds, ...(input.experienceIds ?? [])].map(String))];
  const missionIds = [...new Set([...existingMissionIds, ...(input.missionIds ?? [])].map(String))];

  let promotedMemoryId = typeof existing?.promoted_memory_id === "string" ? existing.promoted_memory_id : null;
  if (input.validation.status === "PROMOTED" && !promotedMemoryId) {
    const memory = await storeIntelligenceMemory({
      tenantId: input.tenantId,
      memoryType: "LESSON",
      title: "Validated learning",
      content: input.candidate.lesson,
      domain: input.candidate.domain,
      confidence: input.validation.confidence,
      source: "M10.6_LESSON_PROMOTION",
      sourceRef: input.candidate.missionId,
      tags: ["M10.6", "PROMOTED"],
      metadata: {
        candidateKey: input.candidate.candidateKey,
        evidenceCount: input.validation.evidenceCount,
        supportCount: input.validation.supportCount,
        contradictionCount: input.validation.contradictionCount,
        provenance: input.candidate.provenance
      }
    });
    promotedMemoryId = memory && typeof memory === "object" && "id" in memory ? String((memory as Record<string, unknown>).id) : null;
  }

  const payload = {
    tenant_id: input.tenantId,
    candidate_key: input.candidate.candidateKey,
    lesson: input.candidate.lesson,
    domain: input.candidate.domain ?? null,
    status: input.validation.status,
    evidence_count: input.validation.evidenceCount,
    support_count: input.validation.supportCount,
    contradiction_count: input.validation.contradictionCount,
    confidence: input.validation.confidence,
    source_experience_ids: experienceIds,
    source_mission_ids: missionIds,
    provenance: { ...input.candidate.provenance, validation: input.validation.rationale },
    promoted_memory_id: promotedMemoryId,
    first_observed_at: existing?.first_observed_at ?? now,
    last_validated_at: now,
    promoted_at: input.validation.status === "PROMOTED" ? (existing?.promoted_at ?? now) : (existing?.promoted_at ?? null),
    updated_at: now
  };

  const response = await db("ce_intelligence_lessons?on_conflict=tenant_id,candidate_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  const rows = await response.json() as unknown[];
  return rows[0] ?? null;
}

export async function validateAndPromoteLesson(input: {
  tenantId: string;
  candidate: LessonCandidate;
  experiences: LessonValidationInput[];
}) {
  const validation = validateLessonCandidate({ candidate: input.candidate, experiences: input.experiences });
  const result = await promoteValidatedLesson({
    tenantId: input.tenantId,
    candidate: input.candidate,
    validation,
    experienceIds: input.experiences.map(x => x.id),
    missionIds: input.experiences.map(x => x.mission_id).filter(Boolean) as string[]
  });
  return { candidate: input.candidate, validation, result };
}

export type LessonValidationInput = {
  id: string;
  mission_id?: string | null;
  outcome_quality?: LearningQuality;
  success?: boolean | null;
  extracted_lessons?: unknown;
};
