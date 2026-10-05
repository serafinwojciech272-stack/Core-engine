import { createHash } from "node:crypto";
import type { UniversalAgentPlan } from "@/lib/universal-agent";

export const UNIVERSAL_AGENT_OS_VERSION = "uaos-v1" as const;

export const UAOS_STAGES = [
  { id: 125, name: "UNIVERSAL_AGENT_RUNTIME_STATE_MACHINE", phase: "RUNTIME" },
  { id: 126, name: "DURABLE_AGENT_RUN_LEDGER", phase: "PERSISTENCE" },
  { id: 127, name: "MISSION_CAPABILITY_ORCHESTRATOR", phase: "ORCHESTRATION" },
  { id: 128, name: "MEMORY_EVIDENCE_LOOP", phase: "MEMORY" },
  { id: 129, name: "OUTCOME_MEASUREMENT_INTEGRATION", phase: "MEASURE" },
  { id: 130, name: "ADAPTIVE_REPLANNING_ENGINE", phase: "CONTINUATION" },
  { id: 131, name: "RECOVERY_AWARE_UNIVERSAL_AGENT", phase: "RECOVERY" },
  { id: 132, name: "PROVIDER_ROUTING_AND_FALLBACK", phase: "PROVIDER" },
  { id: 133, name: "AGENT_RUN_AUDIT_LINEAGE", phase: "AUDIT" },
  { id: 134, name: "UNIVERSAL_AGENT_CONTROL_PLANE", phase: "CONTROL" },
  { id: 135, name: "CLOSED_LOOP_END_TO_END_VERIFICATION", phase: "CERTIFICATION" }
] as const;

export type UniversalAgentOsStageId = typeof UAOS_STAGES[number]["id"];
export type UniversalAgentOsStatus =
  | "CREATED" | "PLANNED" | "AWAITING_APPROVAL" | "APPROVED"
  | "EXECUTING" | "VERIFYING" | "MEASURING" | "LEARNING"
  | "REPLANNING" | "RECOVERING" | "HANDED_OFF" | "COMPLETED" | "BLOCKED";

export type UniversalAgentRun = {
  runId: string;
  version: typeof UNIVERSAL_AGENT_OS_VERSION;
  objective: string;
  planIntegrity: string;
  status: UniversalAgentOsStatus;
  currentStage: UniversalAgentOsStageId;
  approved: boolean;
  executionPermission: boolean;
  provider: string | null;
  fallbackProviders: string[];
  evidence: string[];
  outcomes: string[];
  feedback: string[];
  recoveryCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lineage: string;
};

const now = () => new Date().toISOString();
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createUniversalAgentRun(plan: UniversalAgentPlan): UniversalAgentRun {
  if (!plan.request?.objective || !plan.integrity) throw new Error("PLAN_INVALID");
  const t = now();
  const base = {
    objective: plan.request.objective,
    planIntegrity: plan.integrity,
    status: "CREATED" as const,
    currentStage: 125 as const,
    approved: false,
    executionPermission: false,
    provider: null,
    fallbackProviders: [],
    evidence: [],
    outcomes: [],
    feedback: [],
    recoveryCount: 0,
    revision: 1,
    createdAt: t,
    updatedAt: t
  };
  return {
    ...base,
    runId: "uar_" + digest({ objective: base.objective, plan: base.planIntegrity }).slice(0, 24),
    version: UNIVERSAL_AGENT_OS_VERSION,
    lineage: digest(base)
  };
}

function nextStatus(stage: UniversalAgentOsStageId, approved: boolean): UniversalAgentOsStatus {
  if (stage === 125) return "PLANNED";
  if (stage === 126 || stage === 127) return approved ? "APPROVED" : "AWAITING_APPROVAL";
  if (stage === 128) return "LEARNING";
  if (stage === 129) return "MEASURING";
  if (stage === 130) return "REPLANNING";
  if (stage === 131) return "RECOVERING";
  if (stage === 132 || stage === 133) return "EXECUTING";
  if (stage === 134) return "HANDED_OFF";
  return "COMPLETED";
}

export function approveUniversalAgentRun(run: UniversalAgentRun): UniversalAgentRun {
  if (run.status === "BLOCKED") throw new Error("RUN_BLOCKED");
  const next = {
    ...run,
    approved: true,
    executionPermission: true,
    status: "APPROVED" as const,
    currentStage: Math.max(127, run.currentStage) as UniversalAgentOsStageId,
    updatedAt: now(),
    revision: run.revision + 1
  };
  return { ...next, lineage: digest({ previous: run.lineage, event: "APPROVED", revision: next.revision }) };
}

export function selectUniversalAgentProvider(
  providers: Array<{ id: string; available: boolean; score: number }>,
  requiredCapability: string
) {
  const ranked = providers
    .filter(p => p.available && p.id.trim())
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (!ranked.length) throw new Error("NO_PROVIDER_AVAILABLE");
  return {
    selected: ranked[0].id,
    fallbacks: ranked.slice(1, 5).map(p => p.id),
    capability: requiredCapability
  };
}

export function advanceUniversalAgentRun(
  run: UniversalAgentRun,
  evidence: string[] = [],
  outcome?: string
): UniversalAgentRun {
  if (!run.approved && run.currentStage >= 125) throw new Error("HUMAN_APPROVAL_REQUIRED");
  const index = UAOS_STAGES.findIndex(s => s.id === run.currentStage);
  if (index < 0) throw new Error("RUN_STAGE_NOT_FOUND");
  const nextStage = UAOS_STAGES[index + 1]?.id;
  const cleanEvidence = [...new Set(evidence.map(String).map(x => x.trim()).filter(Boolean))].slice(0, 30);
  const outcomes = outcome ? [...run.outcomes, outcome.trim()].filter(Boolean).slice(-20) : run.outcomes;
  const next = nextStage === undefined
    ? { ...run, currentStage: 135 as const, status: "COMPLETED" as const }
    : { ...run, currentStage: nextStage, status: nextStatus(nextStage, run.approved) };
  const updated = {
    ...next,
    evidence: [...run.evidence, ...cleanEvidence].slice(-100),
    outcomes,
    updatedAt: now(),
    revision: run.revision + 1
  };
  return {
    ...updated,
    lineage: digest({
      previous: run.lineage,
      stage: run.currentStage,
      nextStage: updated.currentStage,
      evidence: cleanEvidence,
      outcome,
      revision: updated.revision
    })
  };
}

export function recoverUniversalAgentRun(run: UniversalAgentRun, reason: string): UniversalAgentRun {
  const clean = reason.trim().slice(0, 500);
  if (!clean) throw new Error("RECOVERY_REASON_REQUIRED");
  const next = {
    ...run,
    status: "RECOVERING" as const,
    currentStage: 131 as const,
    recoveryCount: run.recoveryCount + 1,
    feedback: [...run.feedback, clean].slice(-30),
    updatedAt: now(),
    revision: run.revision + 1
  };
  return { ...next, lineage: digest({ previous: run.lineage, recovery: clean, count: next.recoveryCount }) };
}

export function replanUniversalAgentRun(run: UniversalAgentRun, feedback: string[]): UniversalAgentRun {
  const clean = [...new Set(feedback.map(String).map(x => x.trim()).filter(Boolean))].slice(0, 20);
  if (!clean.length) return run;
  const next = {
    ...run,
    status: "REPLANNING" as const,
    currentStage: 130 as const,
    feedback: [...run.feedback, ...clean].slice(-30),
    executionPermission: false,
    updatedAt: now(),
    revision: run.revision + 1
  };
  return { ...next, lineage: digest({ previous: run.lineage, feedback: clean, revision: next.revision }) };
}

export function verifyUniversalAgentRun(run: UniversalAgentRun) {
  return {
    valid: Boolean(run.runId && run.lineage && run.planIntegrity && run.revision > 0),
    terminal: run.status === "COMPLETED",
    approvalIntact: run.executionPermission ? run.approved : true,
    evidenceCount: run.evidence.length,
    outcomeCount: run.outcomes.length,
    recoveryCount: run.recoveryCount
  };
}
