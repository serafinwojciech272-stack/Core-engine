import { createHash } from "node:crypto";
import { listCapabilityPacks } from "@/lib/capability-registry";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { planGrowthCapabilities } from "@/lib/capability-planner";
import { getAgentManifest, type AgentLoopStage } from "@/lib/agent-contract";

export const UNIVERSAL_AGENT_VERSION = "universal-agent-v2" as const;

export const UNIVERSAL_AGENT_STAGES = [
  { id: 113, name: "INTENT_NORMALIZATION", phase: "UNDERSTAND" },
  { id: 114, name: "WORLD_CONTEXT_ASSEMBLY", phase: "UNDERSTAND" },
  { id: 115, name: "CAPABILITY_DISCOVERY", phase: "PLAN" },
  { id: 116, name: "MULTI_STEP_PLAN_COMPILATION", phase: "PLAN" },
  { id: 117, name: "POLICY_AND_RISK_GATE", phase: "GOVERNANCE" },
  { id: 118, name: "HUMAN_APPROVAL_BOUNDARY", phase: "CONTROL" },
  { id: 119, name: "GOVERNED_ACTION_EXECUTION", phase: "EXECUTE" },
  { id: 120, name: "VERIFICATION_AND_EVIDENCE", phase: "VERIFY" },
  { id: 121, name: "OUTCOME_MEASUREMENT", phase: "MEASURE" },
  { id: 122, name: "MEMORY_AND_LEARNING", phase: "LEARN" },
  { id: 123, name: "ADAPTIVE_REPLANNING", phase: "CONTINUATION" },
  { id: 124, name: "UNIVERSAL_AGENT_HANDOFF", phase: "HANDOFF" }
] as const;

export type UniversalAgentStageId = typeof UNIVERSAL_AGENT_STAGES[number]["id"];
export type UniversalAgentStatus = "PLANNED" | "AWAITING_APPROVAL" | "EXECUTING" | "VERIFYING" | "MEASURING" | "LEARNING" | "COMPLETED" | "BLOCKED";

export type UniversalAgentRequest = {
  objective: string;
  domain?: string;
  constraints?: string[];
  signals?: string[];
  diagnosis?: string;
  recommendation?: string;
  approval?: "PENDING" | "APPROVED";
};

export type UniversalAgentPlan = {
  version: typeof UNIVERSAL_AGENT_VERSION;
  agent: ReturnType<typeof getAgentManifest>;
  request: Required<Pick<UniversalAgentRequest, "objective">> & {
    domain: string;
    constraints: string[];
    signals: string[];
  };
  status: UniversalAgentStatus;
  stages: Array<{ id: number; name: string; phase: string; status: "READY" | "PENDING" | "BLOCKED"; reason?: string }>;
  capabilities: Array<{ id: string; name: string; score: number; actions: number }>;
  actions: Array<{ id: string; packId: string; requiresApproval: boolean; risk: string }>;
  policy: { requiresApproval: boolean; reasons: string[]; executionAllowed: boolean };
  integrity: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeObjective(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 1000);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function buildUniversalAgentPlan(input: UniversalAgentRequest): UniversalAgentPlan {
  ensureCapabilityPacks();
  const objective = normalizeObjective(input.objective);
  if (!objective) throw new Error("OBJECTIVE_REQUIRED");

  const domain = (input.domain?.trim().toLowerCase() || "business").slice(0, 60);
  const constraints = unique((input.constraints ?? []).map(String).map(x => x.trim()).filter(Boolean)).slice(0, 20);
  const signals = unique((input.signals ?? []).map(String).map(x => x.trim()).filter(Boolean)).slice(0, 30);
  const plan = planGrowthCapabilities({
    objective,
    diagnosis: input.diagnosis,
    recommendation: input.recommendation,
    signals
  });

  const packs = plan.selectedPacks.map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    actions: p.actions.length
  }));

  const actions = plan.selectedPacks.flatMap(p =>
    p.actions.map(action => ({
      id: action.id,
      packId: p.id,
      requiresApproval: action.requiresApproval,
      risk: action.risk
    }))
  ).slice(0, 20);

  const reasons = [
    "Universal Agent never bypasses the existing execution boundary.",
    ...(plan.requiresApproval ? ["At least one planned action requires human approval."] : []),
    ...(actions.some(a => a.risk === "HIGH" || a.risk === "CRITICAL") ? ["High-risk capability detected."] : [])
  ];

  const requiresApproval = true;
  const executionAllowed = input.approval === "APPROVED" && !actions.some(a => a.risk === "CRITICAL");

  const stages = UNIVERSAL_AGENT_STAGES.map((stage, index) => ({
    id: stage.id,
    name: stage.name,
    phase: stage.phase,
    status: index === 0 ? "READY" as const : "PENDING" as const
  }));

  if (input.approval !== "APPROVED") {
    stages[7].status = "BLOCKED";
    stages[7].reason = "HUMAN_APPROVAL_REQUIRED";
  }

  const payload = {
    version: UNIVERSAL_AGENT_VERSION,
    objective,
    domain,
    constraints,
    signals,
    capabilities: packs,
    actions,
    policy: { requiresApproval, reasons, executionAllowed }
  };

  return {
    version: UNIVERSAL_AGENT_VERSION,
    agent: getAgentManifest(),
    request: { objective, domain, constraints, signals },
    status: input.approval === "APPROVED" && executionAllowed ? "EXECUTING" : "AWAITING_APPROVAL",
    stages,
    capabilities: packs,
    actions,
    policy: { requiresApproval, reasons, executionAllowed },
    integrity: digest(payload)
  };
}

export function advanceUniversalAgentStage(plan: UniversalAgentPlan, stageId: number, evidence: string[] = []) {
  const index = plan.stages.findIndex(s => s.id === stageId);
  if (index < 0) throw new Error("UNIVERSAL_STAGE_NOT_FOUND");
  const current = plan.stages[index];
  if (current.status === "BLOCKED") throw new Error(current.reason || "UNIVERSAL_STAGE_BLOCKED");

  const next = plan.stages[index + 1];
  const stageEvidence = unique(evidence.filter(Boolean));
  const nextStages = plan.stages.map(s => ({ ...s }));
  nextStages[index] = { ...current, status: "READY" as const, reason: stageEvidence.length ? stageEvidence.join("|") : "stage_completed" };

  if (next) {
    nextStages[index + 1] = { ...next, status: "READY" as const };
  }

  const status: UniversalAgentStatus =
    !next ? "COMPLETED" :
    next.id === 118 ? "AWAITING_APPROVAL" :
    next.id === 119 ? "EXECUTING" :
    next.id === 120 ? "VERIFYING" :
    next.id === 121 ? "MEASURING" :
    next.id === 122 ? "LEARNING" :
    "EXECUTING";

  return { ...plan, stages: nextStages, status };
}

export function canUniversalAgentExecute(plan: UniversalAgentPlan) {
  return {
    allowed: plan.policy.executionAllowed && plan.status !== "BLOCKED",
    reason: !plan.policy.executionAllowed ? "HUMAN_APPROVAL_REQUIRED" : "EXECUTION_ALLOWED"
  };
}

export function universalAgentLoopStage(plan: UniversalAgentPlan): AgentLoopStage {
  switch (plan.status) {
    case "PLANNED":
    case "AWAITING_APPROVAL": return "APPROVE";
    case "EXECUTING": return "EXECUTE";
    case "VERIFYING":
    case "MEASURING": return "MEASURE";
    case "LEARNING": return "LEARN";
    case "COMPLETED": return "LEARN";
    case "BLOCKED": return "DECIDE";
  }
}

export function replanUniversalAgent(plan: UniversalAgentPlan, feedback: string[]) {
  const clean = unique(feedback.map(x => x.trim()).filter(Boolean)).slice(0, 20);
  if (!clean.length) return plan;
  const integrity = digest({ previous: plan.integrity, feedback: clean });
  return {
    ...plan,
    status: "PLANNED" as const,
    request: { ...plan.request, signals: unique([...plan.request.signals, ...clean]).slice(0, 30) },
    integrity
  };
}
export function approveUniversalAgentPlan(plan: UniversalAgentPlan): UniversalAgentPlan {
  if (!plan.request?.objective) {
    // Defensive compatibility guard for malformed external payloads.
    throw new Error("PLAN_INVALID");
  }
  const stages = plan.stages.map(stage =>
    stage.id === 118
      ? { ...stage, status: "READY" as const, reason: "HUMAN_APPROVAL_GRANTED" }
      : stage
  );
  return {
    ...plan,
    status: "EXECUTING",
    stages,
    policy: { ...plan.policy, executionAllowed: true, reasons: [...plan.policy.reasons, "Human approval explicitly granted."] },
    integrity: digest({ previous: plan.integrity, approval: "GRANTED" })
  };
}
