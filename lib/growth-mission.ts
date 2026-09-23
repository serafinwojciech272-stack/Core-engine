import type { CapabilityAction } from "@/lib/capability-contracts";
import { planGrowthCapabilities, type GrowthCapabilityPlan } from "@/lib/capability-planner";

export type GrowthMissionAction = CapabilityAction & {
  packId: string;
  sequence: number;
  status: "PLANNED" | "AWAITING_APPROVAL" | "READY";
};

export type GrowthMissionPlan = GrowthCapabilityPlan & {
  missionId: string;
  approvalGate: "REQUIRED" | "NOT_REQUIRED";
  actions: GrowthMissionAction[];
};

export function buildGrowthMissionPlan(input: {
  missionId: string;
  objective: string;
  diagnosis?: string;
  recommendation?: string;
  signals?: string[];
}): GrowthMissionPlan {
  const base = planGrowthCapabilities(input);
  const actions: GrowthMissionAction[] = [];
  let sequence = 1;
  for (const pack of base.selectedPacks) {
    for (const action of pack.actions) {
      actions.push({
        ...action,
        packId: pack.id,
        sequence: sequence++,
        status: action.requiresApproval || action.risk === "HIGH" || action.risk === "CRITICAL" ? "AWAITING_APPROVAL" : "PLANNED"
      });
    }
  }
  return {
    ...base,
    missionId: input.missionId,
    approvalGate: base.requiresApproval ? "REQUIRED" : "NOT_REQUIRED",
    actions: actions.slice(0, 20)
  };
}

export function canExecuteGrowthAction(
  plan: GrowthMissionPlan,
  actionId: string,
  missionState: string,
  approvedActionIds: string[] = []
) {
  const action = plan.actions.find(a => a.id === actionId);
  if (!action) return { allowed: false, reason: "ACTION_NOT_FOUND" };
  if (missionState !== "APPROVED") return { allowed: false, reason: "MISSION_NOT_APPROVED" };
  if (action.requiresApproval && !approvedActionIds.includes(action.id)) {
    return { allowed: false, reason: "CAPABILITY_APPROVAL_REQUIRED" };
  }
  return { allowed: true, reason: "ACTION_ALLOWED" };
}
