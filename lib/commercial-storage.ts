import { commercialRuntimeStatus } from "@/lib/commercial-runtime";

type Config = { url: string; key: string };

function cfg(): Config | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function request(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try { return await fetch(url, { ...init, cache: "no-store", signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

function headers(key: string) {
  return { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
}

export async function ensureTenant(tenantId: string, tenantKey: string) {
  const c = cfg();
  if (!c) return { durable: false, tenantId, tenantKey };
  const response = await request(c.url + "/rest/v1/ce_tenants?on_conflict=id", {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: tenantId, external_key: tenantKey, name: tenantKey, active: true })
  });
  if (!response.ok) throw new Error("SUPABASE_TENANT_UPSERT_" + response.status);
  return { durable: true, tenantId, tenantKey };
}

export async function bindMissionTenant(missionId: string, tenantId: string) {
  const c = cfg();
  if (!c) return false;
  const response = await request(c.url + "/rest/v1/ce_mission_tenants?on_conflict=mission_id", {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ mission_id: missionId, tenant_id: tenantId })
  });
  if (!response.ok) throw new Error("SUPABASE_MISSION_TENANT_BIND_" + response.status);
  return true;
}

export async function missionBelongsToTenant(missionId: string, tenantId: string) {
  const c = cfg();
  if (!c) return false;
  const url = new URL(c.url + "/rest/v1/ce_mission_tenants");
  url.searchParams.set("mission_id", "eq." + missionId);
  url.searchParams.set("tenant_id", "eq." + tenantId);
  url.searchParams.set("select", "mission_id");
  url.searchParams.set("limit", "1");
  const response = await request(url.toString(), { headers: headers(c.key) });
  if (!response.ok) throw new Error("SUPABASE_MISSION_TENANT_READ_" + response.status);
  const rows = await response.json() as Array<{ mission_id: string }>;
  return rows.length === 1;
}

export async function tenantMissionIds(tenantId: string) {
  const c = cfg();
  if (!c) return [] as string[];
  const url = new URL(c.url + "/rest/v1/ce_mission_tenants");
  url.searchParams.set("tenant_id", "eq." + tenantId);
  url.searchParams.set("select", "mission_id");
  const response = await request(url.toString(), { headers: headers(c.key) });
  if (!response.ok) throw new Error("SUPABASE_TENANT_MISSIONS_READ_" + response.status);
  return (await response.json() as Array<{ mission_id: string }>).map(x => x.mission_id);
}

export async function recordUsage(tenantId: string, actorId: string, eventType: string, missionId?: string, units = 1, metadata: Record<string, unknown> = {}) {
  const c = cfg();
  if (!c) return { durable: false, counted: true };
  const response = await request(c.url + "/rest/v1/ce_usage_events", {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "return=minimal" },
    body: JSON.stringify({ tenant_id: tenantId, actor_id: actorId, event_type: eventType, mission_id: missionId || null, units, metadata })
  });
  if (!response.ok) throw new Error("SUPABASE_USAGE_EVENT_" + response.status);
  return { durable: true, counted: true };
}

export function commercialRuntimeReadiness() {
  const c = cfg();
  return { ...commercialRuntimeStatus(), persistence: c ? "supabase" : "memory" } as const;
}
