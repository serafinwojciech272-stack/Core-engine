import { createSupabaseAtomicRecoveryCommit } from "@/lib/recovery-supabase-adapter";
import {
  getRecoveryPayloadHash,
  RecoveryConflictError,
  type AtomicCommitPort,
  type AtomicRecoveryCommitInput,
  type AtomicRecoveryCommitResult,
} from "@/lib/recovery-contract";

export type {
  AtomicCommitPort,
  AtomicRecoveryCommitInput,
  AtomicRecoveryCommitResult,
  RecoveryCheckpoint,
  RecoveryLearning,
} from "@/lib/recovery-contract";
export { RecoveryConflictError, getRecoveryPayloadHash };

export class InMemoryAtomicRecoveryCommit implements AtomicCommitPort {
  private readonly commits = new Map<string, { hash: string; result: AtomicRecoveryCommitResult }>();

  async commit(input: AtomicRecoveryCommitInput): Promise<AtomicRecoveryCommitResult> {
    const hash = getRecoveryPayloadHash(input);
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

export { createSupabaseAtomicRecoveryCommit };
