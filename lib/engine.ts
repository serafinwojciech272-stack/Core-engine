export const MISSION_STATES = [
  "DISCOVERED","DIAGNOSED","PROPOSED","AWAITING_APPROVAL","APPROVED",
  "EXECUTING","MEASURING","COMPLETED","LEARNED","FAILED","REJECTED","EXPIRED"
] as const;
export type MissionState = typeof MISSION_STATES[number];

export type EngineSignal = { name: string; value: string; source: string };
import type { ProbabilityEstimate } from "@/lib/probability-engine";

export type Decision = {
  id: string;
  diagnosis: string;
  recommendation: string;
  confidence: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  evidence: string[];
  probabilities?: { p1R: number; p2R: number; p3R: number };
  probability?: ProbabilityEstimate;
  expectedR?: number;
  riskGate?: "PASS" | "CAUTION" | "BLOCK";
  signalConflict?: {
    status: "NONE" | "DETECTED";
    supporting: string[];
    conflicting: string[];
    dominant: string;
    reasons: string[];
  };
};
export type Mission = {
  id: string;
  decisionId: string;
  objective: string;
  state: MissionState;
  kpi: string;
  createdAt: string;
  updatedAt: string;
  executionCount: number;
};

const transitions: Record<MissionState, MissionState[]> = {
  DISCOVERED:["DIAGNOSED","EXPIRED"], DIAGNOSED:["PROPOSED","FAILED"],
  PROPOSED:["AWAITING_APPROVAL","EXPIRED"], AWAITING_APPROVAL:["APPROVED","REJECTED","EXPIRED"],
  APPROVED:["EXECUTING","REJECTED"], EXECUTING:["MEASURING","FAILED"],
  MEASURING:["COMPLETED","FAILED"], COMPLETED:["LEARNED"], LEARNED:[],
  FAILED:["EXECUTING","REJECTED"], REJECTED:[], EXPIRED:[]
};

export function canTransition(from: MissionState, to: MissionState) {
  return transitions[from].includes(to);
}

export function transitionMission(mission: Mission, next: MissionState): Mission {
  if (!canTransition(mission.state, next)) {
    throw new Error(`Invalid mission transition: ${mission.state} -> ${next}`);
  }
  return {...mission, state: next, updatedAt: new Date().toISOString()};
}

export type EngineEvent = {
  id: string;
  missionId: string;
  decisionId?: string;
  eventType: "MISSION_CREATED" | "STATE_CHANGED";
  fromState?: MissionState;
  toState?: MissionState;
  actorType: "system" | "human" | "agent";
  createdAt: string;
};

const eventStore = globalThis as typeof globalThis & {
  __coreEngineEvents?: EngineEvent[];
};
if (!eventStore.__coreEngineEvents) eventStore.__coreEngineEvents = [];

export const events = eventStore.__coreEngineEvents;

export function recordMissionEvent(input: Omit<EngineEvent, "id" | "createdAt">) {
  const event: EngineEvent = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  events.push(event);
  if (events.length > 500) events.splice(0, events.length - 500);
  return event;
}

const store = globalThis as typeof globalThis & {
  __coreEngineMissions?: Map<string, Mission>;
};
if (!store.__coreEngineMissions) store.__coreEngineMissions = new Map();

export const missions = store.__coreEngineMissions;
