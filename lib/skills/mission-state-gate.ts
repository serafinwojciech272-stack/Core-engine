import type { MissionState } from "@/lib/engine";

export type GovernedMissionPhase = "EXECUTION" | "MEASUREMENT" | "LEARNING";

const requiredState: Record<GovernedMissionPhase, MissionState> = {
  EXECUTION: "APPROVED",
  MEASUREMENT: "EXECUTING",
  LEARNING: "COMPLETED"
};

export function canEnterGovernedMissionPhase(state: MissionState, phase: GovernedMissionPhase): boolean {
  return state === requiredState[phase];
}

export function assertGovernedMissionPhase(state: MissionState, phase: GovernedMissionPhase): void {
  if (!canEnterGovernedMissionPhase(state, phase)) {
    throw new Error("MISSION_STATE_GATE_BLOCKED:" + phase + ":expected=" + requiredState[phase] + ":actual=" + state);
  }
}

export function requiredMissionStateForPhase(phase: GovernedMissionPhase): MissionState {
  return requiredState[phase];
}
