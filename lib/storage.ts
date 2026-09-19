import type { Decision, Mission, MissionState } from "@/lib/engine";

type StorageMode = "supabase" | "memory";
const STORAGE_TIMEOUT_MS = 8000;

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function storageMode(): StorageMode { return getConfig() ? "supabase" : "memory"; }

async function supabaseFetch(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STORAGE_TIMEOUT_MS);
  try { return await fetch(url, { ...init, cache: "no-store", signal: controller.signal }); }
  catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("SUPABASE_REQUEST_TIMEOUT");
    throw error;
  } finally { clearTimeout(timeout); }
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const config = getConfig();
  if (!config) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const response = await supabaseFetch(config.url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: config.key, Authorization: "Bearer " + config.key, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("SUPABASE_RPC_" + response.status);
  return response.json() as Promise<T>;
}

export async function persistDecisionMission(decision: Decision, mission: Mission) {
  await rpc("ce_create_decision_mission", { p_decision_id: decision.id, p_diagnosis: decision.diagnosis, p_recommendation: decision.recommendation, p_confidence: decision.confidence, p_priority: decision.priority, p_evidence: decision.evidence, p_mission_id: mission.id, p_objective: mission.objective, p_state: mission.state, p_kpi: mission.kpi });
}

export async function transitionPersistedMission(id: string, next: MissionState, actorType: "system" | "human" | "agent") {
  return rpc<{ mission_id: string; decision_id: string; from_state: MissionState; to_state: MissionState; execution_count: number }>("ce_transition_mission", { p_mission_id: id, p_next_state: next, p_actor_type: actorType });
}

export async function listPersistedMissions(): Promise<Mission[]> {
  const config = getConfig();
  if (!config) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const response = await supabaseFetch(config.url + "/rest/v1/ce_missions?select=id,decision_id,objective,state,kpi,created_at,updated_at,execution_count&order=created_at.desc", { headers: { apikey: config.key, Authorization: "Bearer " + config.key } });
  if (!response.ok) throw new Error("SUPABASE_READ_" + response.status);
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id: String(row.id), decisionId: String(row.decision_id), objective: String(row.objective), state: row.state as MissionState, kpi: String(row.kpi), createdAt: String(row.created_at), updatedAt: String(row.updated_at), executionCount: Number(row.execution_count) }));
}

export async function listPersistedEvents() {
  const config = getConfig();
  if (!config) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const response = await supabaseFetch(config.url + "/rest/v1/ce_events?select=id,mission_id,decision_id,event_type,from_state,to_state,actor_type,created_at&order=created_at.desc&limit=100", { headers: { apikey: config.key, Authorization: "Bearer " + config.key } });
  if (!response.ok) throw new Error("SUPABASE_EVENTS_" + response.status);
  return response.json();
}
