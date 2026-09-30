import type { SkillCapability, SkillDefinition, SkillExecutionContext, SkillMode } from "./types";
import { evaluateSkillRiskGate } from "./risk-gate";
import { getTool } from "./tool-registry";
import { evaluateRisk, type RiskLimits, type RiskSnapshot } from "./risk-engine";

export type ExecutionStage =
  | "CORE"
  | "SKILL_REGISTRY"
  | "TOOL_REGISTRY"
  | "CAPABILITY_CONTRACT"
  | "POLICY"
  | "PLANNER"
  | "RISK"
  | "APPROVAL"
  | "EXECUTOR"
  | "VERIFIER"
  | "MEMORY"
  | "LEARNING";

export const executionPlaneStages: readonly ExecutionStage[] = [
  "CORE",
  "SKILL_REGISTRY",
  "TOOL_REGISTRY",
  "CAPABILITY_CONTRACT",
  "POLICY",
  "PLANNER",
  "RISK",
  "APPROVAL",
  "EXECUTOR",
  "VERIFIER",
  "MEMORY",
  "LEARNING",
];

export type ExecutionRequest = {
  skill: SkillDefinition;
  capabilityId: string;
  context: SkillExecutionContext;
  riskSnapshot?: RiskSnapshot;
  riskLimits?: RiskLimits;
  approved: boolean;
};

export type ExecutionDecision = {
  allowed: boolean;
  stage: ExecutionStage;
  reasons: string[];
  requiredTools: string[];
};

function findCapability(skill: SkillDefinition, capabilityId: string): SkillCapability | undefined {
  return skill.capabilities.find((capability) => capability.id === capabilityId);
}

function hasRequiredTools(capability: SkillCapability): string[] {
  return capability.requiredTools.filter((toolId) => !getTool(toolId));
}

export function evaluateExecutionRequest(request: ExecutionRequest): ExecutionDecision {
  const { skill, capabilityId, context } = request;
  const capability = findCapability(skill, capabilityId);

  if (!capability) {
    return { allowed: false, stage: "CAPABILITY_CONTRACT", reasons: ["UNKNOWN_CAPABILITY"], requiredTools: [] };
  }

  const missingTools = hasRequiredTools(capability);
  if (missingTools.length > 0) {
    return { allowed: false, stage: "TOOL_REGISTRY", reasons: missingTools.map((id) => `MISSING_TOOL:${id}`), requiredTools: capability.requiredTools };
  }

  const gate = evaluateSkillRiskGate(skill, capabilityId, context);
  if (!gate.allowed) {
    return { allowed: false, stage: "POLICY", reasons: gate.reasons, requiredTools: capability.requiredTools };
  }

  if (request.riskSnapshot && request.riskLimits) {
    const risk = evaluateRisk(request.riskSnapshot, request.riskLimits);
    if (!risk.allowed) {
      return { allowed: false, stage: "RISK", reasons: risk.reasons, requiredTools: capability.requiredTools };
    }
  }

  if (capability.riskLevel === "HIGH" || capability.riskLevel === "CRITICAL") {
    if (!request.approved) {
      return { allowed: false, stage: "APPROVAL", reasons: ["HUMAN_APPROVAL_REQUIRED"], requiredTools: capability.requiredTools };
    }
  }

  if (context.mode === "LIVE" && capability.riskLevel !== "LOW" && !request.approved) {
    return { allowed: false, stage: "APPROVAL", reasons: ["LIVE_REQUIRES_APPROVAL"], requiredTools: capability.requiredTools };
  }

  return { allowed: true, stage: "EXECUTOR", reasons: [], requiredTools: capability.requiredTools };
}

export function isModeAllowed(capability: SkillCapability, mode: SkillMode): boolean {
  return capability.modes.includes(mode);
}
