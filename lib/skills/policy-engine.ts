import type { SkillCapability, SkillDefinition, SkillExecutionContext } from "./types";

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reasons: string[];
  policyIds: string[];
};

export type PolicyInput = {
  skill: SkillDefinition;
  capability: SkillCapability;
  context: SkillExecutionContext;
  approved: boolean;
  killSwitchActive: boolean;
};

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const reasons: string[] = [];
  const policyIds = input.skill.policies.map((_, index) => `${input.skill.id}.policy.${index + 1}`);
  const requiresApproval =
    input.context.approvalRequired ||
    input.capability.riskLevel === "HIGH" ||
    input.capability.riskLevel === "CRITICAL";

  if (input.killSwitchActive) reasons.push("KILL_SWITCH_ACTIVE");
  if (requiresApproval && !input.approved) reasons.push("EXPLICIT_APPROVAL_REQUIRED");

  return {
    allowed: reasons.length === 0,
    requiresApproval,
    reasons,
    policyIds,
  };
}
