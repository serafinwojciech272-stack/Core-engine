import { storeIntelligenceMemory } from "@/lib/intelligence-core";

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
    ...init, cache: "no-store", headers: { ...headers(c.key), ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error(`LEARNING_CONSOLIDATION_DB_${response.status}`);
  return response;
}

type RecoveryPattern = {
  id: string;
  pattern_key: string;
  failure_types: string[];
  trigger_signature: string;
  preconditions: unknown[];
  recovery_steps: unknown[];
  evidence_count: number;
  success_count: number;
  failure_count: number;
  success_rate: number | null;
  avg_recovery_delta_pct: number | null;
  confidence: number | null;
  status: "EXPERIMENTAL" | "ACTIVE" | "DEPRECATED";
  version: number;
};

export function shouldActivateConsolidatedStrategy(pattern: Pick<RecoveryPattern, "status" | "evidence_count" | "success_rate">) {
  return pattern.status === "ACTIVE" && pattern.evidence_count >= 2 && (pattern.success_rate ?? 0) >= 0.7;
}

function strategyName(pattern: RecoveryPattern) {
  return `Recovery strategy: ${pattern.pattern_key}`.slice(0, 240);
}

async function latestStrategy(tenantId: string, name: string) {
  const c = cfg();
  const url = new URL(`${c.url}/rest/v1/ce_intelligence_strategies`);
  url.searchParams.set("tenant_id", `eq.${tenantId}`);
  url.searchParams.set("name", `eq.${name}`);
  url.searchParams.set("order", "version.desc");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: headers(c.key), cache: "no-store" });
  if (!response.ok) throw new Error(`LEARNING_STRATEGY_LOOKUP_${response.status}`);
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows[0];
}

async function consolidatePattern(tenantId: string, pattern: RecoveryPattern) {
  const name = strategyName(pattern);
  const prior = await latestStrategy(tenantId, name);
  const priorSources = Array.isArray(prior?.source_recovery_pattern_ids)
    ? prior.source_recovery_pattern_ids.map(String)
    : [];
  const alreadyConsolidated =
    priorSources.includes(pattern.id) &&
    Number(prior?.evidence_count ?? -1) === pattern.evidence_count &&
    Number(prior?.success_count ?? -1) === pattern.success_count &&
    Number(prior?.failure_count ?? -1) === pattern.failure_count &&
    Number(prior?.version ?? 0) >= pattern.version;
  if (alreadyConsolidated) return { status: "UNCHANGED", strategy: prior };

  const active = pattern.status === "ACTIVE" &&
    pattern.evidence_count >= 2 &&
    (pattern.success_rate ?? 0) >= 0.7;

  const body = {
    tenant_id: tenantId,
    name,
    domain: null,
    problem_pattern: pattern.trigger_signature,
    description: `Consolidated recovery strategy derived from verified recovery pattern ${pattern.pattern_key}.`,
    steps: pattern.recovery_steps,
    applicability_conditions: pattern.preconditions,
    failure_conditions: [
      `Failure types: ${pattern.failure_types.join(", ")}`,
      `Observed recovery failures: ${pattern.failure_count}`,
    ],
    source_experience_ids: [],
    source_recovery_pattern_ids: [pattern.id],
    evidence_count: pattern.evidence_count,
    success_count: pattern.success_count,
    failure_count: pattern.failure_count,
    success_rate: pattern.success_rate,
    avg_delta_pct: pattern.avg_recovery_delta_pct,
    confidence: pattern.confidence,
    status: active ? "ACTIVE" : "EXPERIMENTAL",
    version: Number(prior?.version ?? 0) + 1,
    supersedes_id: prior?.id ?? null,
  };

  const response = await db("ce_intelligence_strategies", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const rows = await response.json() as unknown[];
  const strategy = rows[0] ?? null;

  await storeIntelligenceMemory({
    tenantId,
    memoryType: "STRATEGY",
    title: active ? "Consolidated recovery strategy" : "Experimental recovery strategy",
    content: `Recovery pattern ${pattern.pattern_key}: ${pattern.recovery_steps.join(" → ")}. Evidence ${pattern.evidence_count}, success rate ${pattern.success_rate ?? "unverified"}.`,
    confidence: pattern.confidence ?? 0.5,
    source: "M11.4_LEARNING_CONSOLIDATION",
    sourceRef: pattern.id,
    tags: ["learning", "recovery", active ? "active" : "experimental"],
    metadata: { recoveryPatternId: pattern.id, patternVersion: pattern.version },
  });

  return { status: active ? "ACTIVATED" : "CONSOLIDATED_EXPERIMENTAL", strategy };
}

export async function consolidateLearning(input: {
  tenantId: string;
  domain?: string;
  limit?: number;
}) {
  const c = cfg();
  const url = new URL(`${c.url}/rest/v1/ce_intelligence_recovery_patterns`);
  url.searchParams.set("tenant_id", `eq.${input.tenantId}`);
  url.searchParams.set("status", "neq.DEPRECATED");
  url.searchParams.set("select", "id,pattern_key,failure_types,trigger_signature,preconditions,recovery_steps,evidence_count,success_count,failure_count,success_rate,avg_recovery_delta_pct,confidence,status,version");
  url.searchParams.set("order", "confidence.desc,created_at.desc");
  url.searchParams.set("limit", String(Math.min(input.limit ?? 20, 50)));

  const response = await fetch(url, { headers: headers(c.key), cache: "no-store" });
  if (!response.ok) throw new Error(`LEARNING_PATTERN_RECALL_${response.status}`);
  const patterns = await response.json() as RecoveryPattern[];

  const results = [];
  for (const pattern of patterns) {
    results.push(await consolidatePattern(input.tenantId, pattern));
  }

  return {
    processed: patterns.length,
    activated: results.filter(x => x.status === "ACTIVATED").length,
    experimental: results.filter(x => x.status === "CONSOLIDATED_EXPERIMENTAL").length,
    unchanged: results.filter(x => x.status === "UNCHANGED").length,
    results,
  };
}
