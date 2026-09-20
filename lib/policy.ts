import type { MissionState } from "@/lib/engine";

export type MissionAction = "approve" | "reject" | "execute" | "measure" | "complete" | "learn" | "fail" | "retry" | "abort";

export type PolicyDecision = {
  allowed: boolean;
  actor: "human" | "system";
  reason: string;
};

const policy: Record<MissionAction, { states: MissionState[]; actor: "human" | "system" }> = {
  approve: { states: ["AWAITING_APPROVAL"], actor: "human" },
  reject: { states: ["AWAITING_APPROVAL", "APPROVED"], actor: "human" },
  execute: { states: ["APPROVED"], actor: "system" },
  measure: { states: ["EXECUTING"], actor: "system" },
  complete: { states: ["MEASURING"], actor: "system" },
  learn: { states: ["COMPLETED"], actor: "system" },
  fail: { states: ["EXECUTING", "MEASURING"], actor: "system" },
  retry: { states: ["FAILED"], actor: "system" },
  abort: { states: ["FAILED", "AWAITING_APPROVAL", "APPROVED"], actor: "human" }
};

export function evaluateMissionAction(action: string, state: MissionState): PolicyDecision {
  const rule = policy[action as MissionAction];
  if (!rule) return { allowed: false, actor: "system", reason: "ACTION_NOT_IN_POLICY" };
  if (!rule.states.includes(state)) return { allowed: false, actor: rule.actor, reason: "STATE_NOT_ALLOWED_BY_POLICY" };
  return { allowed: true, actor: rule.actor, reason: "POLICY_ALLOWED" };
}
