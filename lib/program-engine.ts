export const PROGRAM_STAGES = [
  { id: 101, name: "AUTONOMOUS_PROGRAM_CONTINUATION", phase: "BRIDGE" },
  { id: 102, name: "TRANSACTIONAL_EXECUTION_BOUNDARY", phase: "EXECUTION" },
  { id: 103, name: "PERSISTENT_CHECKPOINT_INTEGRITY", phase: "PERSISTENCE" },
  { id: 104, name: "VALIDATION_EVIDENCE_ENGINE", phase: "VALIDATION" },
  { id: 105, name: "RECOVERY_AND_RESUME", phase: "RECOVERY" },
  { id: 106, name: "SCOPE_ENFORCEMENT", phase: "GOVERNANCE" },
  { id: 107, name: "AUTONOMOUS_EXECUTOR", phase: "EXECUTION" },
  { id: 108, name: "EVALUATION_GATE_INTEGRATION", phase: "QUALITY" },
  { id: 109, name: "CROSS_STAGE_STATE_CONSISTENCY", phase: "INTEGRITY" },
  { id: 110, name: "HUMAN_APPROVAL_GATE", phase: "CONTROL" },
  { id: 111, name: "AUTONOMOUS_PROGRAM_CONTINUATION", phase: "CONTINUATION" },
  { id: 112, name: "DYNAMIC_STAGE_EXPANSION_ENGINE", phase: "PLANNING" }
] as const;

export type ProgramStageId = typeof PROGRAM_STAGES[number]["id"];
export type ProgramStatus = "PLANNED" | "RUNNING" | "PAUSED" | "BLOCKED" | "COMPLETED" | "FAILED";
export type CheckpointStatus = "CREATED" | "VALIDATED" | "APPROVED" | "EXECUTED" | "FAILED";

export type ProgramScope = {
  maxStages: number;
  allowedDomains: string[];
  allowedActions: string[];
  requireHumanApproval: boolean;
};

export type ProgramStage = {
  id: number;
  name: string;
  phase: string;
  status: "PENDING" | "READY" | "RUNNING" | "PASSED" | "BLOCKED" | "FAILED";
  evidence: string[];
  checkpoint?: string;
};

export type ProgramPlan = {
  programId: string;
  version: "program-v1";
  status: ProgramStatus;
  objective: string;
  scope: ProgramScope;
  stages: ProgramStage[];
  nextStage: number | null;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_SCOPE: ProgramScope = {
  maxStages: 50,
  allowedDomains: ["business", "growth", "operations", "sales", "marketing", "trading"],
  allowedActions: ["analyze", "decide", "create_mission", "execute_approved", "measure", "learn"],
  requireHumanApproval: true
};

const now = () => new Date().toISOString();

export function createProgram(objective: string, requestedScope?: Partial<ProgramScope>): ProgramPlan {
  const scope = {
    ...DEFAULT_SCOPE,
    ...requestedScope,
    maxStages: Math.max(1, Math.min(100, Math.floor(requestedScope?.maxStages ?? DEFAULT_SCOPE.maxStages))),
    allowedDomains: requestedScope?.allowedDomains?.slice(0, 20) ?? DEFAULT_SCOPE.allowedDomains,
    allowedActions: requestedScope?.allowedActions?.slice(0, 30) ?? DEFAULT_SCOPE.allowedActions
  };
  const stages: ProgramStage[] = PROGRAM_STAGES.map((s, i) => ({
    id: s.id,
    name: s.name,
    phase: s.phase,
    status: i === 0 ? "READY" : "PENDING",
    evidence: []
  }));
  const timestamp = now();
  return {
    programId: crypto.randomUUID(),
    version: "program-v1",
    status: "PLANNED",
    objective: objective.trim().slice(0, 500) || "Continue the Core Engine program safely.",
    scope,
    stages,
    nextStage: stages[0]?.id ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function validateProgram(plan: ProgramPlan) {
  const errors: string[] = [];
  if (!plan.programId || plan.version !== "program-v1") errors.push("PROGRAM_ID_OR_VERSION_INVALID");
  if (plan.stages.length > plan.scope.maxStages) errors.push("STAGE_SCOPE_EXCEEDED");
  const ids = new Set<number>();
  for (const stage of plan.stages) {
    if (ids.has(stage.id)) errors.push("DUPLICATE_STAGE:" + stage.id);
    ids.add(stage.id);
    if (!stage.name || !stage.phase) errors.push("STAGE_METADATA_MISSING:" + stage.id);
  }
  const currentIndex = plan.nextStage === null ? -1 : plan.stages.findIndex((s) => s.id === plan.nextStage);
  if (plan.nextStage !== null && currentIndex < 0) errors.push("NEXT_STAGE_NOT_FOUND");
  return { valid: errors.length === 0, errors, evidence: [
    "stage_count=" + plan.stages.length,
    "scope_maxStages=" + plan.scope.maxStages,
    "nextStage=" + String(plan.nextStage)
  ]};
}

export function enforceScope(plan: ProgramPlan, domain: string, action: string) {
  const domainOk = plan.scope.allowedDomains.includes(domain);
  const actionOk = plan.scope.allowedActions.includes(action);
  return {
    allowed: domainOk && actionOk,
    reason: !domainOk ? "DOMAIN_OUT_OF_SCOPE" : !actionOk ? "ACTION_OUT_OF_SCOPE" : "SCOPE_ALLOWED"
  };
}

export function executionGate(plan: ProgramPlan, stage: ProgramStage) {
  const validation = validateProgram(plan);
  if (!validation.valid) return { allowed: false, reason: "VALIDATION_FAILED" };
  if (stage.status !== "READY" && stage.status !== "RUNNING") return { allowed: false, reason: "STAGE_NOT_READY" };
  if (plan.scope.requireHumanApproval && plan.status !== "RUNNING") {
    return { allowed: false, reason: "HUMAN_APPROVAL_REQUIRED" };
  }
  return { allowed: true, reason: "EXECUTION_ALLOWED" };
}

export function approveProgram(plan: ProgramPlan): ProgramPlan {
  return { ...plan, status: "RUNNING", updatedAt: now() };
}

export function continueProgram(plan: ProgramPlan): ProgramPlan {
  const stages: ProgramStage[] = plan.stages.map((stage) => {
    if (stage.id !== plan.nextStage) return stage;
    return { ...stage, status: "PASSED", evidence: [...stage.evidence, "stage_passed"], checkpoint: crypto.randomUUID() };
  });
  const nextIndex = stages.findIndex((stage) => stage.status === "PENDING" || stage.status === "READY");
  const nextStage = nextIndex >= 0 ? stages[nextIndex].id : null;
  if (nextIndex >= 0) stages[nextIndex] = { ...stages[nextIndex], status: "READY" };
  return { ...plan, status: nextStage === null ? "COMPLETED" : "RUNNING", stages, nextStage, updatedAt: now() };
}

