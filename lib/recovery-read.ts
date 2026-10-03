import type { RecoveryCheckpoint, RecoveryLearning } from "@/lib/recovery-atomic-commit";

export type RecoveryReadQuery = {
  tenantId: string;
  recoveryKey: string;
  idempotencyKey?: string | null;
};

export type RecoveryReadResult = {
  commitId: string;
  tenantId: string;
  recoveryKey: string;
  idempotencyKey: string;
  payloadHash: string;
  createdAt: string;
  checkpoint: RecoveryCheckpoint;
  learning: RecoveryLearning | null;
};

export type RecoveryReadPort = {
  read(query: RecoveryReadQuery): Promise<RecoveryReadResult | null>;
};

export class InMemoryRecoveryRead implements RecoveryReadPort {
  constructor(private readonly records: RecoveryReadResult[] = []) {}

  async read(query: RecoveryReadQuery): Promise<RecoveryReadResult | null> {
    return this.records
      .filter((record) =>
        record.tenantId === query.tenantId &&
        record.recoveryKey === query.recoveryKey &&
        (!query.idempotencyKey || record.idempotencyKey === query.idempotencyKey),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }
}

export class SupabaseRecoveryRead implements RecoveryReadPort {
  constructor(
    private readonly rpc: (name: string, body: Record<string, unknown>) => Promise<unknown>,
  ) {}

  async read(query: RecoveryReadQuery): Promise<RecoveryReadResult | null> {
    const result = await this.rpc("ce_recovery_read", {
      p_tenant_id: query.tenantId,
      p_recovery_key: query.recoveryKey,
      p_idempotency_key: query.idempotencyKey ?? null,
    });

    return result as RecoveryReadResult | null;
  }
}

export function createSupabaseRecoveryRead(): RecoveryReadPort {
  return new SupabaseRecoveryRead(async (name, body) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");

    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}`);
    return response.json();
  });
}

export async function readRecovery(
  query: RecoveryReadQuery,
  port: RecoveryReadPort = createSupabaseRecoveryRead(),
): Promise<RecoveryReadResult | null> {
  if (!query.tenantId || !query.recoveryKey) {
    throw new Error("RECOVERY_READ_QUERY_INVALID");
  }

  return port.read(query);
}
