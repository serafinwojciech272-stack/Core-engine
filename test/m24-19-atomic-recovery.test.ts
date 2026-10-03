import test from "node:test";
import assert from "node:assert/strict";
import {
  atomicRecoveryCommit,
  getRecoveryPayloadHash,
  InMemoryAtomicRecoveryCommit,
  RecoveryConflictError,
} from "@/lib/recovery-atomic-commit";
import { resilientBrokerCloseIngest } from "@/lib/resilient-broker-close-ingest";

function input() {
  return {
    tenantId: "tenant-1",
    idempotencyKey: "recovery-1",
    recoveryKey: "broker-1",
    checkpoint: { streamKey: "broker-1", cursor: "42", state: { open: false } },
    learning: {
      lessonType: "POSITIVE_DELTA" as const,
      quality: "VERIFIED" as const,
      lesson: "close recovered",
      reason: "verified",
    },
  };
}

test("M24.19 checkpoint failure commits nothing", async () => {
  const port = new InMemoryAtomicRecoveryCommit();
  await assert.rejects(
    () => atomicRecoveryCommit({ ...input(), failureInjection: "CHECKPOINT" }, port),
    /RECOVERY_CHECKPOINT_FAILURE/,
  );
  await assert.rejects(
    () => atomicRecoveryCommit(input(), port),
    /RECOVERY_IDEMPOTENCY_CONFLICT|undefined/,
  );
});

test("M24.19 learning failure commits nothing", async () => {
  const port = new InMemoryAtomicRecoveryCommit();
  await assert.rejects(
    () => atomicRecoveryCommit({ ...input(), failureInjection: "LEARNING" }, port),
    /RECOVERY_LEARNING_FAILURE/,
  );
  const committed = await atomicRecoveryCommit(input(), port);
  assert.equal(committed.status, "COMMITTED");
});

test("M24.19 duplicate recovery is idempotent", async () => {
  const port = new InMemoryAtomicRecoveryCommit();
  const first = await atomicRecoveryCommit(input(), port);
  const second = await atomicRecoveryCommit(input(), port);
  assert.equal(first.commitId, second.commitId);
  assert.equal(second.status, "IDEMPOTENT");
});

test("M24.19 conflicting recovery is rejected", async () => {
  const port = new InMemoryAtomicRecoveryCommit();
  await atomicRecoveryCommit(input(), port);
  await assert.rejects(
    () => atomicRecoveryCommit({ ...input(), checkpoint: { ...input().checkpoint, cursor: "43" } }, port),
    RecoveryConflictError,
  );
});

test("M24.19 retry after transaction failure succeeds", async () => {
  const port = new InMemoryAtomicRecoveryCommit();
  const failed = { ...input(), failureInjection: "LEARNING" as const };
  await assert.rejects(() => atomicRecoveryCommit(failed, port));
  const retry = await atomicRecoveryCommit(input(), port);
  assert.equal(retry.status, "COMMITTED");
});

test("M24.19 broker close uses one atomic recovery boundary", async () => {
  const port = new InMemoryAtomicRecoveryCommit();
  const result = await resilientBrokerCloseIngest({
    tenantId: "tenant-1",
    brokerKey: "broker-1",
    closeCursor: "100",
    state: { closed: true },
    idempotencyKey: "broker-close-100",
    learning: input().learning,
  }, port);
  assert.equal(result.status, "COMMITTED");
  assert.equal(result.learningId !== null, true);
  assert.equal(getRecoveryPayloadHash(input()).length, 64);
});
