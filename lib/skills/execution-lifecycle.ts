import type { SkillCapability, SkillDefinition, SkillExecutionContext } from "./types";
import { evaluateExecutionRequest, type ExecutionDecision } from "./execution-plane";
import { evaluatePolicy, type PolicyDecision } from "./policy-engine";
import { evaluateRisk, type RiskLimits, type RiskSnapshot } from "./risk-engine";

export type ExecutionLifecycleState =
  | "PLANNED"
  | "POLICY_CHECKED"
  | "RISK_CHECKED"
  | "APPROVAL_REQUIRED"
  | "APPROVED"
  | "EXECUTION_READY"
  | "EXECUTED"
  | "VERIFIED"
  | "MEMORIZED"
  | "LEARNED"
  | "REJECTED";

export type PlannerOutput = {
  planId: string;
  correlationId: string;
  skillId: string;
  capabilityId: string;
  mode: SkillExecutionContext["mode"];
  steps: string[];
  requiredTools: string[];
  evidenceIds: string[];
};

export type ApprovalObject = {
  approvalId: string;
  correlationId: string;
  required: boolean;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  reason: string;
};

export type ExecutionResult = {
  executionId: string;
  correlationId: string;
  status: "NOT_EXECUTED" | "EXECUTED" | "FAILED";
  sideEffect: boolean;
  evidenceIds: string[];
  output?: unknown;
};

export type VerificationResult = {
  verificationId: string;
  correlationId: string;
  passed: boolean;
  checks: string[];
  evidenceIds: string[];
};

export type MemoryEvent = {
  eventId: string;
  correlationId: string;
  type: "EXECUTION_VERIFIED";
  evidenceIds: string[];
  payload: Record<string, unknown>;
};

export type LearningEvent = {
  eventId: string;
  correlationId: string;
  type: "OUTCOME_RESOLVED";
  evidenceIds: string[];
  eligible: boolean;
  payload: Record<string, unknown>;
};

export type ExecutionLifecycleRequest = {
  skill: SkillDefinition;
  capabilityId: string;
  context: SkillExecutionContext;
  approved: boolean;
  approvedBy?: string;
  riskSnapshot?: RiskSnapshot;
  riskLimits?: RiskLimits;
  evidenceIds?: string[];
  execute?: () => ExecutionResult;
  verify?: (execution: ExecutionResult) => VerificationResult;
};

export type ExecutionLifecycleResult = {
  state: ExecutionLifecycleState;
  plan: PlannerOutput;
  policy: PolicyDecision;
  risk: { allowed: boolean; reasons: string[] };
  approval: ApprovalObject;
  execution: ExecutionResult;
  verification?: VerificationResult;
  memory?: MemoryEvent;
  learning?: LearningEvent;
  decision: ExecutionDecision;
  auditTrail: readonly ExecutionLifecycleState[];
};

function findCapability(skill: SkillDefinition, capabilityId: string): SkillCapability | undefined {
  return skill.capabilities.find((item) => item.id === capabilityId);
}

function ids(prefix: string, correlationId: string): string {
  return `${prefix}:${correlationId}`;
}

export function createPlannerOutput(request: ExecutionLifecycleRequest): PlannerOutput {
  const capability = findCapability(request.skill, request.capabilityId);
  return {
    planId: ids("plan", request.context.correlationId),
    correlationId: request.context.correlationId,
    skillId: request.skill.id,
    capabilityId: request.capabilityId,
    mode: request.context.mode,
    steps: [
      "CAPABILITY_CONTRACT",
      "POLICY",
      "PLANNER",
      "RISK",
      "APPROVAL",
      "EXECUTOR",
      "VERIFIER",
      "MEMORY",
      "LEARNING",
    ],
    requiredTools: capability?.requiredTools ?? [],
    evidenceIds: [...(request.evidenceIds ?? [])],
  };
}

export function runExecutionLifecycle(request: ExecutionLifecycleRequest): ExecutionLifecycleResult {
  const plan = createPlannerOutput(request);
  const capability = findCapability(request.skill, request.capabilityId);
  const baseDecision = evaluateExecutionRequest({
    skill: request.skill,
    capabilityId: request.capabilityId,
    context: request.context,
    approved: request.approved,
    killSwitchActive: request.riskSnapshot?.killSwitchActive ?? false,
    riskSnapshot: request.riskSnapshot,
    riskLimits: request.riskLimits,
  });

  const policy = capability
    ? evaluatePolicy({
        skill: request.skill,
        capability,
        context: request.context,
        approved: request.approved,
        killSwitchActive: request.riskSnapshot?.killSwitchActive ?? false,
      })
    : { allowed: false, requiresApproval: true, reasons: ["UNKNOWN_CAPABILITY"], policyIds: [] };

  const risk = request.riskSnapshot && request.riskLimits
    ? evaluateRisk(request.riskSnapshot, request.riskLimits)
    : { allowed: true, reasons: [] };

  const approval: ApprovalObject = {
    approvalId: ids("approval", request.context.correlationId),
    correlationId: request.context.correlationId,
    required: policy.requiresApproval,
    approved: request.approved,
    approvedBy: request.approvedBy,
    reason: policy.requiresApproval ? "GOVERNED_EXECUTION" : "NOT_REQUIRED",
  };

  const trail: ExecutionLifecycleState[] = ["PLANNED"];

  if (!baseDecision.allowed || !policy.allowed || !risk.allowed) {
    trail.push(
      "POLICY_CHECKED",
      ...(risk.allowed ? [] : ["RISK_CHECKED" as const]),
      "REJECTED",
    );
    return {
      state: "REJECTED",
      plan,
      policy,
      risk,
      approval,
      execution: {
        executionId: ids("execution", request.context.correlationId),
        correlationId: request.context.correlationId,
        status: "NOT_EXECUTED",
        sideEffect: false,
        evidenceIds: plan.evidenceIds,
      },
      decision: baseDecision,
      auditTrail: trail,
    };
  }

  trail.push("POLICY_CHECKED", "RISK_CHECKED");
  if (approval.required) trail.push("APPROVED");
  trail.push("EXECUTION_READY");

  const execution = request.execute
    ? request.execute()
    : {
        executionId: ids("execution", request.context.correlationId),
        correlationId: request.context.correlationId,
        status: "NOT_EXECUTED" as const,
        sideEffect: false,
        evidenceIds: plan.evidenceIds,
      };

  if (execution.status !== "EXECUTED") {
    return {
      state: "EXECUTION_READY",
      plan,
      policy,
      risk,
      approval,
      execution,
      decision: baseDecision,
      auditTrail: trail,
    };
  }

  trail.push("EXECUTED");
  const verification = request.verify?.(execution);
  if (!verification) {
    return {
      state: "EXECUTED",
      plan,
      policy,
      risk,
      approval,
      execution,
      decision: baseDecision,
      auditTrail: trail,
    };
  }

  if (!verification.passed) {
    return {
      state: "EXECUTED",
      plan,
      policy,
      risk,
      approval,
      execution,
      verification,
      decision: baseDecision,
      auditTrail: trail,
    };
  }

  trail.push("VERIFIED");
  const evidenceIds = [...new Set([...plan.evidenceIds, ...execution.evidenceIds, ...verification.evidenceIds])];
  const memory: MemoryEvent = {
    eventId: ids("memory", request.context.correlationId),
    correlationId: request.context.correlationId,
    type: "EXECUTION_VERIFIED",
    evidenceIds,
    payload: { skillId: request.skill.id, capabilityId: request.capabilityId, mode: request.context.mode },
  };
  trail.push("MEMORIZED");

  const learning: LearningEvent = {
    eventId: ids("learning", request.context.correlationId),
    correlationId: request.context.correlationId,
    type: "OUTCOME_RESOLVED",
    evidenceIds,
    eligible: true,
    payload: { verified: true, executionStatus: execution.status },
  };
  trail.push("LEARNED");

  return {
    state: "LEARNED",
    plan,
    policy,
    risk,
    approval,
    execution,
    verification,
    memory,
    learning,
    decision: baseDecision,
    auditTrail: trail,
  };
}
