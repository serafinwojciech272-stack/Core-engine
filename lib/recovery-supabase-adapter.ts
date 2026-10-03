import type {
  AtomicCommitPort,
  AtomicRecoveryCommitInput,
  AtomicRecoveryCommitResult,
} from "@/lib/recovery-contract";

type Rpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;

export class SupabaseAtomicRecoveryCommit implements AtomicCommitPort {
  constructor(private readonly rpc: Rpc) {}

  async commit(input: AtomicRecoveryCommitInput): Promise<AtomicRecoveryCommitResult> {
    return await this.rpc("ce_atomic_recovery_commit", {
      p_tenant_id: input.tenantId,
      p_idempotency_key: input.idempotencyKey,
      p_recovery_key: input.recoveryKey,
      p_payload_hash: inputHash(input),
      p_checkpoint: input.checkpoint,
      p_learning: input.learning ?? null,
      p_metadata: input.metadata ?? {},
    }) as AtomicRecoveryCommitResult;
  }
}

function inputHash(input: AtomicRecoveryCommitInput) {
  const crypto = require("node:crypto") as typeof import("node:crypto");
  return crypto.createHash("sha256").update(JSON.stringify({
    tenantId: input.tenantId,
    recoveryKey: input.recoveryKey,
    checkpoint: input.checkpoint,
    learning: input.learning ?? null,
    metadata: input.metadata ?? {},
  })).digest("hex");
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
