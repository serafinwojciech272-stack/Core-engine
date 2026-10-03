import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryRecoveryRead,
  readRecovery,
  type RecoveryReadResult,
} from "@/lib/recovery-read";
import { readLatestBrokerRecovery } from "@/lib/resilient-broker-close-ingest";

function record(
  overrides: Partial<RecoveryReadResult> = {},
): RecoveryReadResult {
  return {
    commitId: "commit-1",
    tenantId: "tenant-1",
    recoveryKey: "broker-1",
    idempotencyKey: "close-1",
    payloadHash: "hash-1",
    createdAt: "2026-10-03T08:00:00.000Z",
    checkpoint: {
      streamKey: "broker-1",
      cursor: "100",
      state: { closed: true },
    },
    learning: {
      lessonType: "POSITIVE_DELTA",
      quality: "VERIFIED",
      lesson: "close recovered",
      reason: "verified",
    },
    ...overrides,
  };
}

test("M24.20 reads the latest recovery state for a recovery key", async () => {
  const port = new InMemoryRecoveryRead([
    record(),
    record({
      commitId: "commit-2",
      idempotencyKey: "close-2",
      createdAt: "2026-10-03T09:00:00.000Z",
      checkpoint: {
        streamKey: "broker-1",
        cursor: "200",
        state: { closed: true, reconciled: true },
      },
    }),
  ]);

  const result = await readRecovery({
    tenantId: "tenant-1",
    recoveryKey: "broker-1",
  }, port);

  assert.equal(result?.commitId, "commit-2");
  assert.equal(result?.checkpoint.cursor, "200");
});

test("M24.20 reads an exact idempotency record when requested", async () => {
  const port = new InMemoryRecoveryRead([
    record(),
    record({
      commitId: "commit-2",
      idempotencyKey: "close-2",
      createdAt: "2026-10-03T09:00:00.000Z",
    }),
  ]);

  const result = await readRecovery({
    tenantId: "tenant-1",
    recoveryKey: "broker-1",
    idempotencyKey: "close-1",
  }, port);

  assert.equal(result?.commitId, "commit-1");
});

test("M24.20 broker read-path resolves the latest close state", async () => {
  const port = new InMemoryRecoveryRead([record()]);
  const result = await readLatestBrokerRecovery("tenant-1", "broker-1", port);

  assert.equal(result?.recoveryKey, "broker-1");
  assert.equal(result?.checkpoint.cursor, "100");
  assert.equal(result?.learning?.quality, "VERIFIED");
});

test("M24.20 never crosses tenant boundaries", async () => {
  const port = new InMemoryRecoveryRead([
    record({ tenantId: "tenant-2" }),
  ]);

  const result = await readRecovery({
    tenantId: "tenant-1",
    recoveryKey: "broker-1",
  }, port);

  assert.equal(result, null);
});

test("M24.20 returns null for an unknown recovery", async () => {
  const result = await readRecovery({
    tenantId: "tenant-1",
    recoveryKey: "missing",
  }, new InMemoryRecoveryRead([record()]));

  assert.equal(result, null);
});

test("M24.20 rejects an incomplete read query", async () => {
  await assert.rejects(
    () => readRecovery({ tenantId: "", recoveryKey: "broker-1" }, new InMemoryRecoveryRead()),
    /RECOVERY_READ_QUERY_INVALID/,
  );
});
