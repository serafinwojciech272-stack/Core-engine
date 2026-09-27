import { createHash } from "node:crypto";

type LedgerConfig = { url: string; key: string };

export type CapabilityExecutionClaim = {
  claimMode: "NEW" | "REPLAY" | "IN_PROGRESS" | "RETRY" | "CONFLICT";
  executionId: string;
  status: "EXECUTING" | "EXECUTED" | "FAILED";
  requestHash: string;
  receipt: Record<string, unknown>;
  errorMessage?: string | null;
};

function cfg(): LedgerConfig | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function request(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

export function capabilityRequestHash(input: {
  actionId: string;
  missionId?: string;
  input?: Record<string, unknown>;
}) {
  return createHash("sha256")
    .update(JSON.stringify(stable(input)))
    .digest("hex");
}

export async function claimCapabilityExecution(input: {
  tenantId: string;
  missionId?: string;
  actionId: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<CapabilityExecutionClaim> {
  const c = cfg();
  if (!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");

  const response = await request(`${c.url}/rest/v1/rpc/ce_claim_capability_execution`, {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "return=representation" },
    body: JSON.stringify({
      p_tenant_id: input.tenantId,
      p_mission_id: input.missionId ?? null,
      p_action: input.actionId,
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: input.requestHash,
    }),
  });

  if (!response.ok) throw new Error(`SUPABASE_CAPABILITY_CLAIM_${response.status}`);
  const rows = (await response.json()) as Array<{
    claim_mode: CapabilityExecutionClaim["claimMode"];
    execution_id: string;
    status: CapabilityExecutionClaim["status"];
    request_hash: string;
    receipt: Record<string, unknown>;
    error_message?: string | null;
  }>;
  const row = rows[0];
  if (!row) throw new Error("SUPABASE_CAPABILITY_CLAIM_EMPTY");

  return {
    claimMode: row.claim_mode,
    executionId: row.execution_id,
    status: row.status,
    requestHash: row.request_hash,
    receipt: row.receipt ?? {},
    errorMessage: row.error_message,
  };
}

export async function completeCapabilityExecution(input: {
  executionId: string;
  status: "EXECUTED" | "FAILED";
  receipt?: Record<string, unknown>;
  errorMessage?: string;
}) {
  const c = cfg();
  if (!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");

  const response = await request(`${c.url}/rest/v1/rpc/ce_complete_capability_execution`, {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "return=representation" },
    body: JSON.stringify({
      p_execution_id: input.executionId,
      p_status: input.status,
      p_receipt: input.receipt ?? {},
      p_error_message: input.errorMessage ?? null,
    }),
  });

  if (!response.ok) throw new Error(`SUPABASE_CAPABILITY_COMPLETE_${response.status}`);
}