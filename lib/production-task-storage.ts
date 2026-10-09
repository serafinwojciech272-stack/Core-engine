import type { ProductionTaskRecord } from "@/lib/production-task-harness";

type DbTask = {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  title: string;
  objective: string;
  state: ProductionTaskRecord["state"];
  version: number;
  record: ProductionTaskRecord;
  created_at: string;
  updated_at: string;
};

function config() {
  const rawUrl = process.env.SUPABASE_URL?.trim() || "";
  const url = rawUrl ? (() => { try { return new URL(rawUrl).origin; } catch { return ""; } })() : "";
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  return url && key ? { url, key } : null;
}

async function request(path: string, init: RequestInit = {}) {
  const c = config();
  if (!c) throw new Error("PRODUCTION_TASK_STORAGE_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(c.url + "/rest/v1/" + path, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        apikey: c.key,
        Authorization: "Bearer " + c.key,
        "Content-Type": "application/json",
        ...(init.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

function encode(value: string) {
  return encodeURIComponent(value);
}

function toStored(row: DbTask) {
  return { task: row.record, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function findByIdempotency(tenantId: string, key: string) {
  const path = "ce_production_tasks?tenant_id=eq." + encode(tenantId) +
    "&idempotency_key=eq." + encode(key) + "&select=id,tenant_id,idempotency_key,title,objective,state,version,record,created_at,updated_at&limit=1";
  const response = await request(path);
  if (!response.ok) throw new Error("PRODUCTION_TASK_READ_" + response.status);
  const rows = await response.json() as DbTask[];
  return rows[0] || null;
}

export async function createStoredProductionTask(input: {
  tenantId: string;
  idempotencyKey: string;
  task: ProductionTaskRecord;
}) {
  const existing = await findByIdempotency(input.tenantId, input.idempotencyKey);
  if (existing) return { ...toStored(existing), replayed: true };
  const response = await request("ce_production_tasks", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      idempotency_key: input.idempotencyKey,
      title: input.task.title,
      objective: input.task.objective,
      state: input.task.state,
      version: 1,
      record: input.task
    })
  });
  if (!response.ok) {
    // A concurrent request may have won the unique idempotency-key race.
    if (response.status === 409) {
      const winner = await findByIdempotency(input.tenantId, input.idempotencyKey);
      if (winner) return { ...toStored(winner), replayed: true };
    }
    throw new Error("PRODUCTION_TASK_CREATE_" + response.status);
  }
  const rows = await response.json() as DbTask[];
  if (!rows[0]) throw new Error("PRODUCTION_TASK_CREATE_EMPTY");
  return { ...toStored(rows[0]), replayed: false };
}

export async function getStoredProductionTask(tenantId: string, id: string) {
  const response = await request("ce_production_tasks?tenant_id=eq." + encode(tenantId) +
    "&id=eq." + encode(id) +
    "&select=id,tenant_id,idempotency_key,title,objective,state,version,record,created_at,updated_at&limit=1");
  if (!response.ok) throw new Error("PRODUCTION_TASK_READ_" + response.status);
  const rows = await response.json() as DbTask[];
  return rows[0] ? toStored(rows[0]) : null;
}

export async function updateStoredProductionTask(input: {
  tenantId: string;
  id: string;
  expectedVersion: number;
  task: ProductionTaskRecord;
}) {
  const response = await request("ce_production_tasks?tenant_id=eq." + encode(input.tenantId) +
    "&id=eq." + encode(input.id) +
    "&version=eq." + encode(String(input.expectedVersion)) +
    "&select=id,tenant_id,idempotency_key,title,objective,state,version,record,created_at,updated_at", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title: input.task.title,
      objective: input.task.objective,
      state: input.task.state,
      version: input.expectedVersion + 1,
      record: input.task,
      updated_at: input.task.updatedAt
    })
  });
  if (!response.ok) throw new Error("PRODUCTION_TASK_UPDATE_" + response.status);
  const rows = await response.json() as DbTask[];
  if (!rows[0]) return null; // Version changed or record is outside this tenant.
  return toStored(rows[0]);
}
