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

export class RecoveryConflictError extends Error {
  constructor() {
    super("RECOVERY_IDEMPOTENCY_CONFLICT");
    this.name = "RecoveryConflictError";
  }
}
