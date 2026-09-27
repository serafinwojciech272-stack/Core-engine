export type IntelligenceMemoryType =
  | "OBSERVATION" | "EXPERIENCE" | "LESSON" | "STRATEGY" | "FACT"
  | "BELIEF" | "OPINION" | "UNKNOWN" | "CONTRADICTION";

export type IntelligenceOutcomeQuality = "VERIFIED" | "NEGATIVE" | "UNVERIFIED";

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${c.url}/rest/v1/${path}`, {
      ...init, cache: "no-store", signal: controller.signal, headers: { ...headers(c.key), ...(init.headers || {}) },
    });
    if (!response.ok) throw new Error(`INTELLIGENCE_DB_${response.status}`);
    return response;
  } finally { clearTimeout(timer); }
}

const stop = new Set(["the","and","for","with","that","this","from","into","your","are","was","were","have","has","not","but","then","than","jest","oraz","dla","oraz","jest","być","się","ten","tego","na","do","z"]);
function tokens(value: string) {
  return [...new Set(value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").split(/\s+/).filter(x => x.length > 2 && !stop.has(x)))];
}
function overlap(a: string, b: string) {
  const aa = new Set(tokens(a)); const bb = new Set(tokens(b));
  if (!aa.size || !bb.size) return 0;
  let hit = 0; for (const x of aa) if (bb.has(x)) hit++;
  return hit / Math.max(aa.size, bb.size);
}

export async function storeIntelligenceMemory(input: {
  tenantId: string; missionId?: string; memoryType: IntelligenceMemoryType; title: string; content: string;
  domain?: string; confidence?: number; source?: string; sourceRef?: string; tags?: string[]; metadata?: Record<string, unknown>;
}) {
  const c = cfg();
  const response = await db("ce_intelligence_memories", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      tenant_id: input.tenantId, mission_id: input.missionId ?? null, memory_type: input.memoryType,
      title: input.title.slice(0,240), content: input.content.slice(0,12000), domain: input.domain ?? null,
      confidence: input.confidence ?? null, source: input.source ?? null, source_ref: input.sourceRef ?? null,
      tags: input.tags ?? [], metadata: input.metadata ?? {},
    }),
  });
  const rows = await response.json() as unknown[];
  return rows[0] ?? null;
}

export async function recallIntelligence(input: { tenantId: string; query: string; domain?: string; limit?: number }) {
  const c = cfg();
  const url = new URL(`${c.url}/rest/v1/ce_intelligence_memories`);
  url.searchParams.set("tenant_id", `eq.${input.tenantId}`);
  url.searchParams.set("status", "eq.ACTIVE");
  url.searchParams.set("select", "id,memory_type,title,content,domain,confidence,source,source_ref,observed_at,created_at,tags,metadata");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "200");
  const response = await fetch(url, { headers: headers(c.key), cache: "no-store" });
  if (!response.ok) throw new Error(`INTELLIGENCE_RECALL_${response.status}`);
  const rows = await response.json() as Array<Record<string, unknown>>;
  const query = input.query.trim();
  return rows.map(row => ({
    ...row,
    relevance: overlap(query, `${String(row.title)} ${String(row.content)} ${String(row.domain ?? "")}`),
  })).filter(row => !input.domain || row.domain === input.domain)
    .filter(row => row.relevance > 0 || !query)
    .sort((a,b) => Number(b.relevance) - Number(a.relevance) || Number(b.confidence ?? .5) - Number(a.confidence ?? .5))
    .slice(0, Math.max(1, Math.min(input.limit ?? 10, 50)));
}

export function reflectOnExperience(input: {
  problem: string; hypothesis?: string; decision?: string; action?: string;
  expected?: { before?: number; target?: number; direction?: "higher"|"lower" };
  actual?: { before?: number; after?: number; direction?: "higher"|"lower" };
  failureReason?: string; recoveryAction?: string;
}) {
  const before = input.actual?.before ?? input.expected?.before;
  const after = input.actual?.after;
  const direction = input.actual?.direction ?? input.expected?.direction ?? "higher";
  const numeric = Number.isFinite(before) && Number.isFinite(after);
  const delta = numeric ? after! - before! : null;
  const deltaPct = numeric && before !== 0 ? (delta! / Math.abs(before!)) * 100 : null;
  const success = numeric ? (direction === "lower" ? after! < before! : after! > before!) : null;
  const quality: IntelligenceOutcomeQuality = success === true ? "VERIFIED" : success === false ? "NEGATIVE" : "UNVERIFIED";
  const lessons = success === true
    ? [`The intervention improved the measured outcome; preserve the causal pattern but re-verify it under similar conditions.`]
    : success === false
      ? [`The intervention did not improve the measured outcome; reduce confidence in the hypothesis and test an alternative.`]
      : [`The outcome is not sufficiently verified; do not promote this experience to a successful strategy.`];
  const strategies = success === true
    ? [`Reuse the intervention as a candidate strategy when the problem context and evidence are materially similar.`]
    : success === false
      ? [`Generate a recovery experiment that changes one major assumption before repeating the intervention.`]
      : [`Create a measurement mission before strategy promotion.`];
  return { quality, success, delta, deltaPct, lessons, strategies, failureReason: input.failureReason ?? null, recoveryAction: input.recoveryAction ?? null };
}

export async function recordIntelligenceExperience(input: {
  tenantId: string; missionId?: string; problem: string; hypothesis?: string; decision?: string; action?: string;
  expectedOutcome?: Record<string, unknown>; actualOutcome?: Record<string, unknown>;
  outcomeQuality: IntelligenceOutcomeQuality; delta?: number | null; deltaPct?: number | null;
  success?: boolean | null; failureReason?: string; recoveryAction?: string;
  extractedLessons?: string[]; strategyCandidates?: string[]; confidence?: number;
}) {
  const response = await db("ce_intelligence_experiences", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      tenant_id: input.tenantId, mission_id: input.missionId ?? null, problem: input.problem.slice(0,12000),
      hypothesis: input.hypothesis ?? null, decision: input.decision ?? null, action: input.action ?? null,
      expected_outcome: input.expectedOutcome ?? {}, actual_outcome: input.actualOutcome ?? {},
      outcome_quality: input.outcomeQuality, delta: input.delta ?? null, delta_pct: input.deltaPct ?? null,
      success: input.success ?? null, failure_reason: input.failureReason ?? null, recovery_action: input.recoveryAction ?? null,
      extracted_lessons: input.extractedLessons ?? [], strategy_candidates: input.strategyCandidates ?? [],
      confidence: input.confidence ?? null,
    }),
  });
  const rows = await response.json() as unknown[];
  return rows[0] ?? null;
}

export async function buildIntelligenceReflection(input: {
  tenantId: string; missionId?: string; problem: string; hypothesis?: string; decision?: string; action?: string;
  expected?: { before?: number; target?: number; direction?: "higher"|"lower" };
  actual?: { before?: number; after?: number; direction?: "higher"|"lower" };
  failureReason?: string; recoveryAction?: string; domain?: string;
}) {
  const reflection = reflectOnExperience(input);
  const experience = await recordIntelligenceExperience({
    tenantId: input.tenantId, missionId: input.missionId, problem: input.problem, hypothesis: input.hypothesis,
    decision: input.decision, action: input.action, expectedOutcome: input.expected ?? {}, actualOutcome: input.actual ?? {},
    outcomeQuality: reflection.quality, delta: reflection.delta, deltaPct: reflection.deltaPct,
    success: reflection.success, failureReason: reflection.failureReason ?? undefined,
    recoveryAction: reflection.recoveryAction ?? undefined, extractedLessons: reflection.lessons,
    strategyCandidates: reflection.strategies, confidence: reflection.quality === "VERIFIED" ? .8 : .5,
  });
  for (const lesson of reflection.lessons) {
    await storeIntelligenceMemory({
      tenantId: input.tenantId, missionId: input.missionId, memoryType: "LESSON",
      title: reflection.quality === "VERIFIED" ? "Verified learning" : "Unverified or negative learning",
      content: lesson, domain: input.domain, confidence: reflection.quality === "VERIFIED" ? .8 : .5,
      source: "CORE_ENGINE_REFLECTION", sourceRef: String((experience as Record<string,unknown>)?.id ?? ""),
    });
  }
  return { ...reflection, experience };
}
