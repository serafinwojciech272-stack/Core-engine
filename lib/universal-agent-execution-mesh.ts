import { createHash } from "node:crypto";

export const EXECUTION_MESH_VERSION = "uaem-v1" as const;
export const EXECUTION_MESH_STAGES = [
  [151, "DURABLE_AGENT_SESSION"],
  [152, "TASK_DECOMPOSITION_ENGINE"],
  [153, "DEPENDENCY_GRAPH_SCHEDULER"],
  [154, "PARALLEL_GOVERNED_EXECUTION"],
  [155, "AGENT_COORDINATION_BARRIER"],
  [156, "PROVIDER_ARBITRATION"],
  [157, "DISTRIBUTED_RETRY_RECOVERY"],
  [158, "CROSS_AGENT_MEMORY_BUS"],
  [159, "OUTCOME_ATTRIBUTION_ENGINE"],
  [160, "EXECUTION_COST_GUARD"],
  [161, "SIDE_EFFECT_COMMIT_GATE"],
  [162, "EXECUTION_EVENT_VERIFIER"],
  [163, "MULTI_AGENT_HANDOFF"],
  [164, "SESSION_REPLAY_INTEGRITY"],
  [165, "MESH_HEALTH_ENGINE"],
  [166, "FAILURE_DOMAIN_ROUTER"],
  [167, "MISSION_CONVERGENCE_ENGINE"],
  [168, "AGENT_OUTCOME_MEMORY"],
  [169, "EXECUTION_POLICY_CERTIFICATION"],
  [170, "PRODUCTION_EXECUTION_READINESS"],
  [171, "UNIVERSAL_AGENT_SUPERVISOR"],
  [172, "CROSS_RUN_COORDINATION"],
  [173, "END_TO_END_EXECUTION_PROOF"],
  [174, "MESH_TERMINAL_STATE"],
  [175, "UNIVERSAL_AGENT_EXECUTION_CERTIFICATION"]
] as const;

export type MeshStageId = typeof EXECUTION_MESH_STAGES[number][0];
export type MeshStatus = "CREATED" | "PLANNED" | "AWAITING_APPROVAL" | "EXECUTING" | "RECOVERING" | "VERIFYING" | "COMPLETED" | "BLOCKED";
export type MeshTask = { id: string; capability: string; dependencies: string[]; status: "PENDING" | "READY" | "RUNNING" | "PASSED" | "FAILED"; evidence: string[] };
export type MeshSession = { sessionId: string; runId: string; status: MeshStatus; approved: boolean; executionPermission: boolean; tasks: MeshTask[]; events: string[]; outcomes: string[]; revision: number; integrity: string };

const sha = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

export function createSession(runId: string, tasks: Array<Omit<MeshTask, "status" | "evidence">>): MeshSession {
  if (!runId.trim() || !tasks.length) throw new Error("SESSION_INPUT_INVALID");
  const normalized = tasks.map((t, i) => ({ id: t.id.trim() || `task_${i + 1}`, capability: t.capability.trim(), dependencies: [...new Set(t.dependencies)], status: t.dependencies.length ? "PENDING" as const : "READY" as const, evidence: [] }));
  const base = { runId: runId.trim(), status: "AWAITING_APPROVAL" as const, approved: false, executionPermission: false, tasks: normalized, events: [], outcomes: [], revision: 1 };
  return { ...base, sessionId: `uas_${sha(base).slice(0, 24)}`, integrity: sha(base) };
}

export function approveSession(session: MeshSession): MeshSession {
  if (session.status === "BLOCKED") throw new Error("SESSION_BLOCKED");
  const next = { ...session, approved: true, executionPermission: true, status: "PLANNED" as const, revision: session.revision + 1 };
  return { ...next, integrity: sha({ previous: session.integrity, event: "APPROVED", revision: next.revision }) };
}

export function readyTasks(session: MeshSession) {
  const passed = new Set(session.tasks.filter(t => t.status === "PASSED").map(t => t.id));
  return session.tasks.filter(t => t.status === "READY" || (t.status === "PENDING" && t.dependencies.every(d => passed.has(d))));
}

export function startExecution(session: MeshSession, taskIds: string[]): MeshSession {
  if (!session.approved || !session.executionPermission) throw new Error("HUMAN_APPROVAL_REQUIRED");
  const ready = new Set(readyTasks(session).map(t => t.id));
  const ids = [...new Set(taskIds)].filter(id => ready.has(id));
  if (!ids.length) throw new Error("NO_READY_TASKS");
  const next = { ...session, status: "EXECUTING" as const, tasks: session.tasks.map(t => ids.includes(t.id) ? { ...t, status: "RUNNING" as const } : t), events: [...session.events, ...ids.map(id => `START:${id}`)], revision: session.revision + 1 };
  return { ...next, integrity: sha({ previous: session.integrity, events: ids, revision: next.revision }) };
}

export function recordTaskResult(session: MeshSession, taskId: string, success: boolean, evidence: string[] = [], outcome?: string): MeshSession {
  const task = session.tasks.find(t => t.id === taskId);
  if (!task || task.status !== "RUNNING") throw new Error("TASK_NOT_RUNNING");
  const nextTasks = session.tasks.map(t => t.id === taskId ? { ...t, status: success ? "PASSED" as const : "FAILED" as const, evidence: [...new Set(evidence.map(String).filter(Boolean))].slice(-20) } : t);
  const next = { ...session, tasks: nextTasks, status: success ? "VERIFYING" as const : "RECOVERING" as const, events: [...session.events, `${success ? "PASS" : "FAIL"}:${taskId}`], outcomes: outcome ? [...session.outcomes, outcome].slice(-50) : session.outcomes, revision: session.revision + 1 };
  return { ...next, integrity: sha({ previous: session.integrity, taskId, success, revision: next.revision }) };
}

export function recoverFailedTasks(session: MeshSession) {
  const failed = session.tasks.filter(t => t.status === "FAILED");
  if (!failed.length) return session;
  const next = { ...session, executionPermission: false, status: "RECOVERING" as const, tasks: session.tasks.map(t => t.status === "FAILED" ? { ...t, status: "READY" as const } : t), events: [...session.events, ...failed.map(t => `RECOVERY:${t.id}`)], revision: session.revision + 1 };
  return { ...next, integrity: sha({ previous: session.integrity, recovery: failed.map(t => t.id), revision: next.revision }) };
}

export function reapproveAfterRecovery(session: MeshSession): MeshSession { return approveSession(session); }

export function meshHealth(session: MeshSession) {
  const total = session.tasks.length;
  const passed = session.tasks.filter(t => t.status === "PASSED").length;
  const failed = session.tasks.filter(t => t.status === "FAILED").length;
  return { total, passed, failed, completion: total ? passed / total : 0, healthy: failed === 0 && Boolean(session.integrity) };
}

export function certifyExecutionMesh(session: MeshSession) {
  const health = meshHealth(session);
  const allPassed = health.total > 0 && health.passed === health.total;
  const certified = allPassed && session.approved && session.events.length > 0 && session.outcomes.length > 0 && Boolean(session.integrity);
  return { certified, terminal: certified, health, checks: { approval: session.approved, permission: session.executionPermission, allTasksPassed: allPassed, outcomesMeasured: session.outcomes.length > 0, integrity: Boolean(session.integrity) } };
}
