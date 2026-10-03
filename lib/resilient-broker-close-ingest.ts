import {
  atomicRecoveryCommit,
  createSupabaseAtomicRecoveryCommit,
  type AtomicCommitPort,
  type AtomicRecoveryCommitInput,
  type AtomicRecoveryCommitResult,
} from "@/lib/recovery-atomic-commit";

export type BrokerCloseIngest = {
  tenantId: string;
  brokerKey: string;
  closeCursor: string;
  state: Record<string, unknown>;
  idempotencyKey: string;
  learning?: AtomicRecoveryCommitInput["learning"];
  metadata?: Record<string, unknown>;
};

export async function resilientBrokerCloseIngest(
  input: BrokerCloseIngest,
  recoveryCommit: AtomicCommitPort = createSupabaseAtomicRecoveryCommit(),
): Promise<AtomicRecoveryCommitResult> {
  return atomicRecoveryCommit({
    tenantId: input.tenantId,
    idempotencyKey: input.idempotencyKey,
    recoveryKey: input.brokerKey,
    checkpoint: {
      streamKey: input.brokerKey,
      cursor: input.closeCursor,
      state: input.state,
    },
    learning: input.learning ?? null,
    metadata: {
      source: "BROKER_CLOSE",
      ...(input.metadata ?? {}),
    },
  }, recoveryCommit);
}
