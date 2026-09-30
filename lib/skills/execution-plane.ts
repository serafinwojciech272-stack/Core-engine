import type { SkillCapability, SkillDefinition, SkillExecutionContext, SkillMode } from "./types";
import { evaluateSkillRiskGate } from "./risk-gate";
import { getTool } from "./tool-registry";
import { evaluateRisk, type RiskLimits, type RiskSnapshot } from "./risk-engine";

export type ExecutionStage =
  | "CORE" | "SKILL_REGISTRY" | "TOOL_REGISTRY" | "CAPABILITY_CONTRACT"
  | "POLICY" | "PLANNER" | "RISK" | "APPROVAL" | "EXECUTOR"
  | "VERIFIER" | "MEMORY" | "LEARNING";

export const executionPlaneStages: readonly ExecutionStage[] = [
  "CORE", "SKILL_REGISTRY", "TOOL_REGISTRY", "CAPABILITY_CONTRACT",
  "POLICY", "PLANNER", "RISK", "APPROVAL", "EXECUTOR",
  "VERIFIER", "MEMORY", "LEARNING",
];

export type ExecutionRequest = {
  skill: SkillDefinition;
  capabilityId: string;
  context: SkillExecutionContext;
  riskSnapshot?: RiskSnapshot;
  riskLimits?: RiskLimits;
  approved: boolean;
  killSwitchActive?: boolean;
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

function missingTools(capability: SkillCapability): string[] {
  return capability.requiredTools.filter((toolId) => !getTool(toolId));
}

export function evaluateExecutionRequest(request: ExecutionRequest): ExecutionDecision {
  const { skill, capabilityId, context } = request;
  const capability = findCapability(skill, capabilityId);

  if (!capability) {
    return { allowed: false, stage: "CAPABILITY_CONTRACT", reasons: ["UNKNOWN_CAPABILITY"], requiredTools: [] };
  }

  const missing = missingTools(capability);
  if (missing.length > 0) {
    return {
      allowed: false,
      stage: "TOOL_REGISTRY",
      reasons: missing.map((id) => `MISSING_TOOL:${id}`),
      requiredTools: capability.requiredTools,
    };
  }

  if (!capability.modes.includes(context.mode)) {
    return { allowed: false, stage: "CAPABILITY_CONTRACT", reasons: ["MODE_NOT_ALLOWED"], requiredTools: capability.requiredTools };
  }

  const gate = evaluateSkillRiskGate({
    skill,
    capabilityId,
    mode: context.mode,
    approved: request.approved,
    killSwitchActive: request.killSwitchActive ?? false,
  });

  if (!gate.allowed) {
    const stage: ExecutionStage =
      gate.reason === "EXPLICIT_APPROVAL_REQUIRED" ? "APPROVAL" : "POLICY";
    return { allowed: false, stage, reasons: [gate.reason], requiredTools: capability.requiredTools };
  }

  if (request.riskSnapshot && request.riskLimits) {
    const risk = evaluateRisk(request.riskSnapshot, request.riskLimits);
    if (!risk.allowed) {
      return { allowed: false, stage: "RISK", reasons: risk.reasons, requiredTools: capability.requiredTools };
    }
  }

  return { allowed: true, stage: "EXECUTOR", reasons: [], requiredTools: capability.requiredTools };
}

export function isModeAllowed(capability: SkillCapability, mode: SkillMode): boolean {
  return capability.modes.includes(mode);
}
