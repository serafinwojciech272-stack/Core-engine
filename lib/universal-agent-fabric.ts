import { createHash } from "node:crypto";

export const UNIVERSAL_AGENT_FABRIC_VERSION = "uaf-v1" as const;

export const UAF_STAGES = [
  { id: 136, name: "DURABLE_EVENT_LEDGER", phase: "PERSISTENCE" },
  { id: 137, name: "IDEMPOTENT_RUN_COORDINATOR", phase: "RUNTIME" },
  { id: 138, name: "CAPABILITY_GRAPH_ROUTER", phase: "ORCHESTRATION" },
  { id: 139, name: "CONTEXT_SNAPSHOT_ENGINE", phase: "WORLD_MODEL" },
  { id: 140, name: "POLICY_BUDGET_ENFORCEMENT", phase: "GOVERNANCE" },
  { id: 141, name: "CONCURRENCY_LEASE_GUARD", phase: "RUNTIME" },
  { id: 142, name: "EVIDENCE_PROVENANCE_CHAIN", phase: "EVIDENCE" },
  { id: 143, name: "OUTCOME_FEEDBACK_CONVERGENCE", phase: "LEARNING" },
  { id: 144, name: "FAILURE_CLASSIFICATION_ENGINE", phase: "RECOVERY" },
  { id: 145, name: "PROVIDER_HEALTH_SCORE", phase: "PROVIDER" },
  { id: 146, name: "MISSION_HANDOFF_ENVELOPE", phase: "HANDOFF" },
  { id: 147, name: "AGENT_IDENTITY_AND_SCOPE", phase: "SECURITY" },
  { id: 148, name: "CROSS_RUN_MEMORY_RECONCILIATION", phase: "MEMORY" },
  { id: 149, name: "UNIVERSAL_AGENT_CERTIFICATION", phase: "CERTIFICATION" },
  { id: 150, name: "OPERATING_SYSTEM_READINESS_GATE", phase: "READINESS" }
] as const;

export type UafStageId = typeof UAF_STAGES[number]["id"];
export type LedgerEvent = {
  sequence: number;
  type: string;
  runId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  integrity: string;
};

export type AgentScope = {
  agentId: string;
  tenantId: string;
  domains: string[];
  capabilities: string[];
  maxCost: number;
  requireApproval: boolean;
};

export type ProviderHealth = {
  providerId: string;
  availability: number;
  latencyMs: number;
  errorRate: number;
  score: number;
  observedAt: string;
};

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const timestamp = () => new Date().toISOString();

export function appendLedgerEvent(events: LedgerEvent[], input: Omit<LedgerEvent, "sequence" | "occurredAt" | "integrity">): LedgerEvent[] {
  const previous = events.at(-1)?.integrity ?? "GENESIS";
  const event = {
    ...input,
    sequence: events.length + 1,
    occurredAt: timestamp(),
    integrity: sha({ previous, ...input, sequence: events.length + 1 })
  };
  return [...events, event];
}

export function isLedgerIntact(events: LedgerEvent[]) {
  let previous = "GENESIS";
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.sequence !== i + 1) return false;
    const expected = sha({
      previous,
      type: event.type,
      runId: event.runId,
      payload: event.payload,
      sequence: event.sequence
    });
    if (expected !== event.integrity) return false;
    previous = event.integrity;
  }
  return true;
}

export function idempotencyKey(runId: string, action: string, revision: number) {
  return "idem_" + sha({ runId, action, revision }).slice(0, 32);
}

export function routeCapability(
  graph: Record<string, string[]>,
  capability: string,
  availableProviders: string[]
) {
  const candidates = (graph[capability] ?? []).filter(id => availableProviders.includes(id));
  if (!candidates.length) throw new Error("CAPABILITY_UNAVAILABLE");
  return { capability, primary: candidates[0], fallbacks: candidates.slice(1, 5) };
}

export function buildContextSnapshot(input: {
  objective: string;
  facts: string[];
  unknowns?: string[];
  evidence?: string[];
}) {
  const snapshot = {
    objective: input.objective.trim().slice(0, 500),
    facts: [...new Set(input.facts.map(String).map(x => x.trim()).filter(Boolean))].slice(0, 100),
    unknowns: [...new Set((input.unknowns ?? []).map(String).map(x => x.trim()).filter(Boolean))].slice(0, 50),
    evidence: [...new Set((input.evidence ?? []).map(String).map(x => x.trim()).filter(Boolean))].slice(0, 100),
    capturedAt: timestamp()
  };
  return { ...snapshot, snapshotId: "ctx_" + sha(snapshot).slice(0, 24) };
}

export function enforceBudget(scope: AgentScope, estimatedCost: number) {
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) throw new Error("COST_INVALID");
  if (estimatedCost > scope.maxCost) return { allowed: false, reason: "BUDGET_EXCEEDED" };
  return { allowed: true, reason: "BUDGET_WITHIN_SCOPE" };
}

export function acquireLease(leases: Record<string, string>, runId: string, holder: string) {
  const existing = leases[runId];
  if (existing && existing !== holder) return { acquired: false, reason: "RUN_ALREADY_LEASED" };
  return { acquired: true, leases: { ...leases, [runId]: holder } };
}

export function buildEvidenceChain(evidence: Array<{ source: string; claim: string; confidence?: number }>) {
  return evidence.map((item, index) => ({
    index,
    source: item.source.trim().slice(0, 300),
    claim: item.claim.trim().slice(0, 1000),
    confidence: Math.max(0, Math.min(1, item.confidence ?? 0.5)),
    integrity: sha(item)
  }));
}

export function convergeOutcome(feedback: number[]) {
  const clean = feedback.filter(Number.isFinite).map(x => Math.max(0, Math.min(1, x)));
  if (!clean.length) return { score: 0, trend: "NO_DATA" as const };
  const score = clean.reduce((a, b) => a + b, 0) / clean.length;
  const recent = clean.slice(-Math.min(3, clean.length));
  const prior = clean.slice(0, Math.max(1, clean.length - recent.length));
  const recentScore = recent.reduce((a, b) => a + b, 0) / recent.length;
  const priorScore = prior.reduce((a, b) => a + b, 0) / prior.length;
  return { score, trend: recentScore > priorScore + 0.05 ? "IMPROVING" as const : recentScore < priorScore - 0.05 ? "DECLINING" as const : "STABLE" as const };
}

export function classifyFailure(input: { code?: string; retryable?: boolean; provider?: string; evidence?: string[] }) {
  const code = String(input.code ?? "UNKNOWN").toUpperCase();
  if (input.retryable === false) return { class: "NON_RETRYABLE", action: "ESCALATE" } as const;
  if (/TIMEOUT|429|RATE/.test(code)) return { class: "TRANSIENT_PROVIDER", action: "FALLBACK" } as const;
  if (/AUTH|FORBIDDEN|SCOPE/.test(code)) return { class: "POLICY_OR_AUTH", action: "REQUIRE_REVIEW" } as const;
  if (/VALID|SCHEMA|INPUT/.test(code)) return { class: "INVALID_INPUT", action: "REPLAN" } as const;
  return { class: "UNKNOWN", action: "REVIEW" } as const;
}

export function scoreProviderHealth(input: { availability: number; latencyMs: number; errorRate: number }): ProviderHealth {
  const availability = Math.max(0, Math.min(1, input.availability));
  const latency = Math.max(0, Math.min(1, 1 - input.latencyMs / 10000));
  const errors = Math.max(0, Math.min(1, 1 - input.errorRate));
  return {
    providerId: "computed",
    availability,
    latencyMs: Math.max(0, input.latencyMs),
    errorRate: Math.max(0, input.errorRate),
    score: availability * 0.5 + latency * 0.2 + errors * 0.3,
    observedAt: timestamp()
  };
}

export function buildHandoffEnvelope(input: {
  runId: string;
  objective: string;
  capability: string;
  evidence: string[];
  approvalId: string;
}) {
  if (!input.approvalId.trim()) throw new Error("APPROVAL_ID_REQUIRED");
  const envelope = {
    version: "handoff-v1",
    runId: input.runId,
    objective: input.objective.trim().slice(0, 500),
    capability: input.capability,
    evidence: [...new Set(input.evidence.map(String))].slice(-50),
    approvalId: input.approvalId,
    createdAt: timestamp()
  };
  return { ...envelope, integrity: sha(envelope) };
}

export function validateScope(scope: AgentScope) {
  return Boolean(
    scope.agentId.trim() &&
    scope.tenantId.trim() &&
    scope.domains.length <= 50 &&
    scope.capabilities.length <= 100 &&
    Number.isFinite(scope.maxCost) &&
    scope.maxCost >= 0
  );
}

export function reconcileMemory(entries: Array<{ key: string; value: string; confidence: number }>) {
  const grouped = new Map<string, typeof entries[number]>();
  for (const entry of entries) {
    if (!entry.key.trim()) continue;
    const current = grouped.get(entry.key);
    if (!current || entry.confidence > current.confidence) grouped.set(entry.key, entry);
  }
  return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function certifyUniversalAgent(input: {
  ledgerIntact: boolean;
  approvalIntact: boolean;
  evidenceCount: number;
  outcomeCount: number;
  recoverySafe: boolean;
  scopeValid: boolean;
}) {
  const checks = {
    ledgerIntact: input.ledgerIntact,
    approvalIntact: input.approvalIntact,
    evidenceSufficient: input.evidenceCount > 0,
    outcomesMeasured: input.outcomeCount > 0,
    recoverySafe: input.recoverySafe,
    scopeValid: input.scopeValid
  };
  return { certified: Object.values(checks).every(Boolean), checks };
}

export function readinessGate(input: {
  certification: ReturnType<typeof certifyUniversalAgent>;
  providerAvailable: boolean;
  budgetAllowed: boolean;
  idempotencyPresent: boolean;
}) {
  const ready = input.certification.certified && input.providerAvailable && input.budgetAllowed && input.idempotencyPresent;
  return {
    ready,
    executionPolicy: ready ? "GOVERNED_APPROVED" : "BLOCKED_UNTIL_REMEDIATED",
    reasons: [
      !input.certification.certified ? "CERTIFICATION_FAILED" : null,
      !input.providerAvailable ? "PROVIDER_UNAVAILABLE" : null,
      !input.budgetAllowed ? "BUDGET_BLOCKED" : null,
      !input.idempotencyPresent ? "IDEMPOTENCY_MISSING" : null
    ].filter(Boolean)
  };
}
