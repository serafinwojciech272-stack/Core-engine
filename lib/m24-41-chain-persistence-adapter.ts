import {
  replayPersistedRecoveryCertificationChain,
  type RecoveryCertificationChainRecord,
  type RecoveryCertificationChainReplayResult,
} from "@/lib/m24-40-certification-chain-replay";

export type RecoveryCertificationChainPersistence = {
  persist(record: RecoveryCertificationChainRecord): Promise<RecoveryCertificationChainRecord>;
  read(identity: {
    tenantId: string;
    recoveryKey: string;
    idempotencyKey: string;
  }): Promise<RecoveryCertificationChainRecord | null>;
};

type SupabaseRpcResponse<T> = { data: T | null; error: { message: string } | null };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`SUPABASE_CONFIGURATION_MISSING:${name}`);
  return value;
}

async function callRpc<T>(rpc: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(`${baseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let parsed: SupabaseRpcResponse<T>;
  try {
    parsed = (await response.json()) as SupabaseRpcResponse<T>;
  } catch {
    throw new Error(`SUPABASE_RPC_INVALID_RESPONSE:${rpc}`);
  }

  if (!response.ok || parsed.error || parsed.data === null) {
    throw new Error(parsed.error?.message ?? `SUPABASE_RPC_FAILED:${rpc}`);
  }

  return parsed.data;
}

function fromRow(row: Record<string, unknown>): RecoveryCertificationChainRecord {
  return {
    tenantId: String(row.tenant_id),
    recoveryKey: String(row.recovery_key),
    idempotencyKey: String(row.idempotency_key),
    evidenceHash: String(row.evidence_hash),
    evidenceDecisionHash: String(row.evidence_decision_hash),
    reconciliationHash: String(row.reconciliation_hash),
    closureHash: String(row.closure_hash),
    terminalHash: String(row.terminal_hash),
    certificationHash: String(row.certification_hash),
    chainHash: String(row.chain_hash),
    chainPayload: row.chain_payload as RecoveryCertificationChainRecord["chainPayload"],
    chainedAt: String(row.chained_at),
  };
}

function toPersistBody(record: RecoveryCertificationChainRecord): Record<string, unknown> {
  return {
    p_tenant_id: record.tenantId,
    p_recovery_key: record.recoveryKey,
    p_idempotency_key: record.idempotencyKey,
    p_evidence_hash: record.evidenceHash,
    p_evidence_decision_hash: record.evidenceDecisionHash,
    p_reconciliation_hash: record.reconciliationHash,
    p_closure_hash: record.closureHash,
    p_terminal_hash: record.terminalHash,
    p_certification_hash: record.certificationHash,
    p_chain_hash: record.chainHash,
    p_chain_payload: record.chainPayload,
    p_chained_at: record.chainedAt,
  };
}

export const supabaseRecoveryCertificationChainPersistence: RecoveryCertificationChainPersistence = {
  async persist(record) {
    const row = await callRpc<Record<string, unknown>>(
      "ce_persist_recovery_certification_chain",
      toPersistBody(record),
    );
    return fromRow(row);
  },

  async read(identity) {
    const row = await callRpc<Record<string, unknown> | null>(
      "ce_read_recovery_certification_chain",
      {
        p_tenant_id: identity.tenantId,
        p_recovery_key: identity.recoveryKey,
        p_idempotency_key: identity.idempotencyKey,
      },
    );
    return row ? fromRow(row) : null;
  },
};

export async function persistReadReplayRecoveryCertificationChain(
  record: RecoveryCertificationChainRecord,
  persistence: RecoveryCertificationChainPersistence = supabaseRecoveryCertificationChainPersistence,
): Promise<RecoveryCertificationChainReplayResult> {
  const persisted = await persistence.persist(record);
  const readBack = await persistence.read({
    tenantId: record.tenantId,
    recoveryKey: record.recoveryKey,
    idempotencyKey: record.idempotencyKey,
  });

  if (!readBack) {
    return {
      valid: false,
      state: "REPLAY_BLOCKED",
      failures: ["CERTIFICATION_CHAIN_READBACK_MISSING"],
      original: null,
      replayed: null,
    };
  }

  return replayPersistedRecoveryCertificationChain(readBack);
}
