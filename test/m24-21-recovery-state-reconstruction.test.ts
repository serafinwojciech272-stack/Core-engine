import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryRecoveryRead, type RecoveryReadResult } from "@/lib/recovery-read";
import {
  RecoveryStateReconstructor,
  reconstructRecoveryState,
} from "@/lib/recovery-state-reconstruction";

function record(): RecoveryReadResult {
  return {
    commitId: "commit-21",
    tenantId: "tenant-1",
    recoveryKey: "broker-1",
    idempotencyKey: "close-21",
    payloadHash: "hash-21",
    createdAt: "2026-10-03T09:30:00.000Z",
    checkpoint: {
      streamKey: "broker-1",
      cursor: "210",
      state: { closed: true, reconciled: true },
    },
    learning: {
      lessonType: "POSITIVE_DELTA",
      quality: "VERIFIED",
      lesson: "recovery verified",
      reason: "checkpoint reconciled",
      delta: 1,
      deltaPct: 100,
    },
  };
}

test("M24.21 reconstructs state from the committed recovery record", async () => {
  const result = await reconstructRecoveryState(
    "tenant-1",
    "broker-1",
    new RecoveryStateReconstructor(
      new InMemoryRecoveryRead([record()]),
    ),
  );

  assert.equal(result?.commitId, "commit-21");
  assert.equal(result?.checkpoint.cursor, "210");
  assert.equal(result?.checkpoint.state.reconciled, true);
  assert.equal(result?.learning?.quality, "VERIFIED");
  assert.equal(result?.source, "RECOVERY_COMMIT");
});

test("M24.21 returns null when no recovery exists", async () => {
  const result = await reconstructRecoveryState(
    "tenant-1",
    "missing",
    new RecoveryStateReconstructor(
      new InMemoryRecoveryRead([record()]),
    ),
  );

  assert.equal(result, null);
});

test("M24.21 preserves tenant isolation", async () => {
  const result = await reconstructRecoveryState(
    "tenant-2",
    "broker-1",
    new RecoveryStateReconstructor(
      new InMemoryRecoveryRead([record()]),
    ),
  );

  assert.equal(result, null);
});

test("M24.21 rejects incomplete reconstruction input", async () => {
  await assert.rejects(
    () => reconstructRecoveryState(
      "",
      "broker-1",
      new RecoveryStateReconstructor(new InMemoryRecoveryRead()),
    ),
    /RECOVERY_RECONSTRUCTION_QUERY_INVALID/,
  );
});
