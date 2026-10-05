import { createHash, randomUUID } from "node:crypto";
import type { UniversalAgentPlan, UniversalAgentStatus } from "@/lib/universal-agent";

export const UNIVERSAL_AGENT_OS_VERSION = "universal-agent-os-v1" as const;

export const UNIVERSAL_AGENT_OS_STATES = [
  "RECEIVED","UNDERSTANDING","PLANNING","AWAITING_APPROVAL","EXECUTING",
  "VERIFYING","MEASURING","LEARNING","REPLANNING","HANDOFF","COMPLETED","BLOCKED"
] as const;
export type UniversalAgentOsState = typeof UNIVERSAL_AGENT_OS_STATES[number];

export type UniversalAgentRunEvent = {
  id: string; runId: string; type: string; from: UniversalAgentOsState;
  to: UniversalAgentOsState; evidence: string[]; createdAt: string; integrity: string;
};

export type UniversalAgentRun = {
  runId: string;
  version: typeof UNIVERSAL_AGENT_OS_VERSION;
  objective: string;
  state: UniversalAgentOsState;
  plan: UniversalAgentPlan;
  cycle: number;
  events: UniversalAgentRunEvent[];
  createdAt: string;
  updatedAt: string;
  integrity: string;
};

const now = () => new Date().toISOString();
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const TRANSITIONS: Record<UniversalAgentOsState, UniversalAgentOsState[]> = {
  RECEIVED:["UNDERSTANDING","BLOCKED"],
  UNDERSTANDING:["PLANNING","BLOCKED"],
  PLANNING:["AWAITING_APPROVAL","EXECUTING","BLOCKED"],
  AWAITING_APPROVAL:["EXECUTING","BLOCKED"],
  EXECUTING:["VERIFYING","BLOCKED"],
  VERIFYING:["MEASURING","REPLANNING","BLOCKED"],
  MEASURING:["LEARNING","REPLANNING","BLOCKED"],
  LEARNING:["REPLANNING","HANDOFF","COMPLETED","BLOCKED"],
  REPLANNING:["PLANNING","AWAITING_APPROVAL","BLOCKED"],
  HANDOFF:["COMPLETED","BLOCKED"],
  COMPLETED:[],
  BLOCKED:[]
};

export function createUniversalAgentRun(plan: UniversalAgentPlan): UniversalAgentRun {
  const timestamp = now();
  const run: UniversalAgentRun = {
    runId: randomUUID(),
    version: UNIVERSAL_AGENT_OS_VERSION,
    objective: plan.request.objective,
    state: plan.status === "EXECUTING" ? "EXECUTING" : "RECEIVED",
    plan,
    cycle: 0,
    events: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    integrity: ""
  };
  return refreshIntegrity(run);
}

function refreshIntegrity(run: UniversalAgentRun): UniversalAgentRun {
  return { ...run, integrity: digest({
    runId: run.runId, version: run.version, objective: run.objective,
    state: run.state, cycle: run.cycle, planIntegrity: run.plan.integrity,
    eventCount: run.events.length
  })};
}

export function canTransitionUniversalAgentRun(from: UniversalAgentOsState, to: UniversalAgentOsState) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionUniversalAgentRun(
  run: UniversalAgentRun,
  to: UniversalAgentOsState,
  type: string,
  evidence: string[] = []
): UniversalAgentRun {
  if (!canTransitionUniversalAgentRun(run.state, to)) {
    throw new Error(`UNIVERSAL_AGENT_OS_INVALID_TRANSITION:${run.state}->${to}`);
  }
  const cleanEvidence = [...new Set(evidence.map(String).map(x => x.trim()).filter(Boolean))].slice(0, 30);
  const timestamp = now();
  const eventBase = {
    id: randomUUID(), runId: run.runId, type: type.slice(0, 100),
    from: run.state, to, evidence: cleanEvidence, createdAt: timestamp
  };
  const event: UniversalAgentRunEvent = { ...eventBase, integrity: digest(eventBase) };
  return refreshIntegrity({
    ...run, state: to, events: [...run.events, event], updatedAt: timestamp
  });
}

export function approveUniversalAgentRun(run: UniversalAgentRun): UniversalAgentRun {
  if (run.state !== "AWAITING_APPROVAL") throw new Error("APPROVAL_BOUNDARY_NOT_ACTIVE");
  if (!run.plan.policy.requiresApproval) throw new Error("APPROVAL_POLICY_INVALID");
  const plan = {
    ...run.plan,
    status: "EXECUTING" as UniversalAgentStatus,
    policy: { ...run.plan.policy, executionAllowed: true, reasons: [...run.plan.policy.reasons, "OS approval granted."] }
  };
  const approved = refreshIntegrity({ ...run, plan });
  return transitionUniversalAgentRun(approved, "EXECUTING", "HUMAN_APPROVAL_GRANTED", ["explicit_human_approval"]);
}

export function advanceUniversalAgentRun(run: UniversalAgentRun, to: UniversalAgentOsState, evidence: string[] = []) {
  return transitionUniversalAgentRun(run, to, "OS_STAGE_ADVANCE", evidence);
}

export function replanUniversalAgentRun(run: UniversalAgentRun, reason: string) {
  const clean = reason.trim().slice(0, 1000);
  if (!clean) throw new Error("REPLAN_REASON_REQUIRED");
  if (!["VERIFYING","MEASURING","LEARNING"].includes(run.state)) {
    throw new Error("REPLAN_NOT_ALLOWED_FROM_STATE");
  }
  const replanning = transitionUniversalAgentRun(run, "REPLANNING", "ADAPTIVE_REPLAN_REQUESTED", [clean]);
  return refreshIntegrity({ ...replanning, cycle: replanning.cycle + 1 });
}

export function validateUniversalAgentRun(run: UniversalAgentRun) {
  const errors: string[] = [];
  if (run.version !== UNIVERSAL_AGENT_OS_VERSION) errors.push("VERSION_INVALID");
  if (!run.runId || !run.objective) errors.push("IDENTITY_INVALID");
  if (!UNIVERSAL_AGENT_OS_STATES.includes(run.state)) errors.push("STATE_INVALID");
  for (let i=1;i<run.events.length;i++) {
    if (run.events[i].from !== run.events[i-1].to) errors.push("EVENT_CHAIN_INVALID");
  }
  const expected = refreshIntegrity({ ...run, integrity: "" }).integrity;
  if (expected !== run.integrity) errors.push("INTEGRITY_INVALID");
  return { valid: errors.length === 0, errors };
}

export function universalAgentOsSummary(run: UniversalAgentRun) {
  return {
    version: run.version, runId: run.runId, state: run.state,
    cycle: run.cycle, eventCount: run.events.length,
    executionAllowed: run.plan.policy.executionAllowed,
    approvalRequired: run.plan.policy.requiresApproval,
    integrity: run.integrity
  };
}
