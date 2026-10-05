import type { MissionState } from "@/lib/engine";

export const AGENT_CONTRACT_VERSION = "agent-runtime-v1" as const;

export const AGENT_LOOP = [
  "OBSERVE",
  "UNDERSTAND",
  "PRIORITIZE",
  "DECIDE",
  "APPROVE",
  "EXECUTE",
  "MEASURE",
  "LEARN"
] as const;

export type AgentLoopStage = typeof AGENT_LOOP[number];

export type AgentAutonomyMode = "HUMAN_APPROVED";

export type AgentManifest = {
  id: "core-business-agent";
  name: "Core Engine Business Agent";
  contract: typeof AGENT_CONTRACT_VERSION;
  autonomy: AgentAutonomyMode;
  sideEffects: "SIMULATION_ONLY" | "GOVERNED_APPROVED";
  durableState: "SUPABASE_REQUIRED_FOR_PRODUCTION";
  loop: readonly AgentLoopStage[];
  missionStates: readonly MissionState[];
  capabilities: string[];
};

export function getAgentManifest(): AgentManifest {
  return {
    id: "core-business-agent",
    name: "Core Engine Business Agent",
    contract: AGENT_CONTRACT_VERSION,
    autonomy: "HUMAN_APPROVED",
    sideEffects: "GOVERNED_APPROVED",
    durableState: "SUPABASE_REQUIRED_FOR_PRODUCTION",
    loop: AGENT_LOOP,
    missionStates: [
      "DISCOVERED",
      "DIAGNOSED",
      "PROPOSED",
      "AWAITING_APPROVAL",
      "APPROVED",
      "EXECUTING",
      "MEASURING",
      "COMPLETED",
      "LEARNED",
      "FAILED",
      "REJECTED",
      "EXPIRED"
    ],
    capabilities: [
      "context",
      "evidence",
      "diagnosis",
      "prioritization",
      "decision",
      "mission-planning",
      "approval-gate",
      "capability-actions",
      "idempotent-execution",
      "outcome-measurement",
      "learning",
      "audit-trail",\n      "universal-agent-planning",\n      "adaptive-replanning",\n      "research",\n      "build",\n      "deploy",\n      "image-capability",\n      "governed-handoff"
    ]
  };
}

export function agentStageForMissionState(state: MissionState): AgentLoopStage {
  switch (state) {
    case "DISCOVERED":
    case "DIAGNOSED":
      return "UNDERSTAND";
    case "PROPOSED":
      return "DECIDE";
    case "AWAITING_APPROVAL":
      return "APPROVE";
    case "APPROVED":
    case "EXECUTING":
      return "EXECUTE";
    case "MEASURING":
    case "COMPLETED":
      return "MEASURE";
    case "LEARNED":
      return "LEARN";
    case "FAILED":
    case "REJECTED":
    case "EXPIRED":
      return "DECIDE";
  }
}

export function isAgentExecutionAllowed(
  state: MissionState,
  authorization: "APPROVED" | "NOT_APPROVED"
) {
  return state === "APPROVED" && authorization === "APPROVED";
}
