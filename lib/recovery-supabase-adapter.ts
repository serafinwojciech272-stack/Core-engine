import { getRecoveryPayloadHash, type AtomicCommitPort, type AtomicRecoveryCommitInput, type AtomicRecoveryCommitResult } from "@/lib/recovery-contract";

type Rpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;

export class SupabaseAtomicRecoveryCommit implements AtomicCommitPort {
  constructor(private readonly rpc: Rpc) {}

  async commit(input: AtomicRecoveryCommitInput): Promise<AtomicRecoveryCommitResult> {
    return await this.rpc("ce_atomic_recovery_commit", {
      p_tenant_id: input.tenantId,
      p_idempotency_key: input.idempotencyKey,
      p_recovery_key: input.recoveryKey,
      p_payload_hash: getRecoveryPayloadHash(input),
      p_checkpoint: input.checkpoint,
      p_learning: input.learning ?? null,
      p_metadata: input.metadata ?? {},
    }) as AtomicRecoveryCommitResult;
  }
}

export function createSupabaseAtomicRecoveryCommit(): AtomicCommitPort {
  return new SupabaseAtomicRecoveryCommit(async (name, body) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}`);
    return response.json();
  });
}
