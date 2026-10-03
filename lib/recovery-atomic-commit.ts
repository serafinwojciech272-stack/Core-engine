import { createHash } from "node:crypto";

export type RecoveryCheckpoint = {
  streamKey: string;
  cursor: string;
  state: Record<string, unknown>;
};

export type RecoveryLearning = {
  lessonType: "POSITIVE_DELTA" | "NEGATIVE_DELTA" | "UNVERIFIED";
  quality: "VERIFIED" | "NEGATIVE" | "UNVERIFIED";
  lesson: string;
  reason: string;
  delta?: number | null;
  deltaPct?: number | null;
};

export type AtomicRecoveryCommitInput = {
  tenantId: string;
  idempotencyKey: string;
  recoveryKey: string;
  checkpoint: RecoveryCheckpoint;
  learning?: RecoveryLearning | null;
  metadata?: Record<string, unknown>;
  failureInjection?: "CHECKPOINT" | "LEARNING";
};

export type AtomicRecoveryCommitResult = {
  status: "COMMITTED" | "IDEMPOTENT";
  commitId: string;
  checkpointId: string;
  learningId: string | null;
  payloadHash: string;
};

export type AtomicCommitPort = {
  commit(input: AtomicRecoveryCommitInput): Promise<AtomicRecoveryCommitResult>;
};

function payloadHash(input: AtomicRecoveryCommitInput) {
  return createHash("sha256")
    .update(JSON.stringify({
      tenantId: input.tenantId,
      recoveryKey: input.recoveryKey,
      checkpoint: input.checkpoint,
      learning: input.learning ?? null,
      metadata: input.metadata ?? {},
    }))
    .digest("hex");
}

export class RecoveryConflictError extends Error {
  constructor() {
    super("RECOVERY_IDEMPOTENCY_CONFLICT");
    this.name = "RecoveryConflictError";
  }
}

export class InMemoryAtomicRecoveryCommit implements AtomicCommitPort {
  private readonly commits = new Map<string, { hash: string; result: AtomicRecoveryCommitResult }>();

  async commit(input: AtomicRecoveryCommitInput): Promise<AtomicRecoveryCommitResult> {
    const hash = payloadHash(input);
    const prior = this.commits.get(input.idempotencyKey);
    if (prior) {
      if (prior.hash !== hash) throw new RecoveryConflictError();
      return { ...prior.result, status: "IDEMPOTENT" };
    }

    if (input.failureInjection === "CHECKPOINT") throw new Error("RECOVERY_CHECKPOINT_FAILURE");
    if (input.failureInjection === "LEARNING") throw new Error("RECOVERY_LEARNING_FAILURE");

    const result: AtomicRecoveryCommitResult = {
      status: "COMMITTED",
      commitId: crypto.randomUUID(),
      checkpointId: crypto.randomUUID(),
      learningId: input.learning ? crypto.randomUUID() : null,
      payloadHash: hash,
    };
    this.commits.set(input.idempotencyKey, { hash, result });
    return { ...result };
  }
}

export class SupabaseAtomicRecoveryCommit implements AtomicCommitPort {
  constructor(
    private readonly rpc: (name: string, body: Record<string, unknown>) => Promise<unknown>,
  ) {}

  async commit(input: AtomicRecoveryCommitInput): Promise<AtomicRecoveryCommitResult> {
    const hash = payloadHash(input);
    return await this.rpc("ce_atomic_recovery_commit", {
      p_tenant_id: input.tenantId,
      p_idempotency_key: input.idempotencyKey,
      p_recovery_key: input.recoveryKey,
      p_payload_hash: hash,
      p_checkpoint: input.checkpoint,
      p_learning: input.learning ?? null,
      p_metadata: input.metadata ?? {},
    }) as AtomicRecoveryCommitResult;
  }
}

export function getRecoveryPayloadHash(input: AtomicRecoveryCommitInput) {
  return payloadHash(input);
}

export async function atomicRecoveryCommit(
  input: AtomicRecoveryCommitInput,
  port: AtomicCommitPort,
): Promise<AtomicRecoveryCommitResult> {
  if (!input.tenantId || !input.idempotencyKey || !input.recoveryKey) {
    throw new Error("RECOVERY_COMMIT_INPUT_INVALID");
  }
  if (!input.checkpoint.streamKey || !input.checkpoint.cursor) {
    throw new Error("RECOVERY_CHECKPOINT_INVALID");
  }
  return port.commit(input);
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
