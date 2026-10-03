import type { SkillDefinition, SkillMode } from "./types";

const order = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;

export type RiskGateInput = {
  skill: SkillDefinition;
  capabilityId: string;
  mode: SkillMode;
  approved: boolean;
  killSwitchActive: boolean;
};

export function evaluateSkillRiskGate(input: RiskGateInput): { allowed: boolean; reason: string } {
  if (input.killSwitchActive) return { allowed: false, reason: "KILL_SWITCH_ACTIVE" };
  const capability = input.skill.capabilities.find(c => c.id === input.capabilityId);
  if (!capability) return { allowed: false, reason: "CAPABILITY_NOT_FOUND" };
  if (!capability.modes.includes(input.mode)) return { allowed: false, reason: "MODE_NOT_ALLOWED" };
  if (order[capability.riskLevel] >= order.HIGH && !input.approved) {
    return { allowed: false, reason: "EXPLICIT_APPROVAL_REQUIRED" };
  }
  return { allowed: true, reason: "RISK_GATE_PASSED" };
}
