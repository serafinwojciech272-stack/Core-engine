import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryRecoveryRead, type RecoveryReadResult } from "@/lib/recovery-read";
import { RecoveryStateReconstructor } from "@/lib/recovery-state-reconstruction";
import {
  RecoveryDecisionEngine,
  evaluateRecoveryDecision,
  decideRecovery,
} from "@/lib/recovery-decision-engine";

function state(overrides: Record<string, unknown> = {}, learning: RecoveryReadResult["learning"] = {
  lessonType: "POSITIVE_DELTA",
  quality: "VERIFIED",
  lesson: "verified",
  reason: "recovery confirmed",
}) {
  return {
    tenantId: "tenant-1",
    recoveryKey: "broker-1",
    commitId: "commit-22",
    payloadHash: "hash-22",
    checkpoint: {
      streamKey: "broker-1",
      cursor: "220",
      state: { reconciled: true, ...overrides },
    },
    learning,
    reconstructedAt: "2026-10-03T09:40:00.000Z",
    source: "RECOVERY_COMMIT" as const,
  };
}

test("M24.22 returns NO_ACTION for verified reconciled state", () => {
  const result = evaluateRecoveryDecision(state());
  assert.equal(result.decision, "NO_ACTION");
  assert.equal(result.requiresApproval, false);
  assert.ok(result.checks.every((check) => check.passed));
});

test("M24.22 returns REPLAY when replay is explicitly required", () => {
  const result = evaluateRecoveryDecision(state({ replayRequired: true }));
  assert.equal(result.decision, "REPLAY");
  assert.equal(result.requiresApproval, true);
});

test("M24.22 returns RESUME for paused resumable state", () => {
  const result = evaluateRecoveryDecision(state({ reconciled: false, paused: true, resumable: true }));
  assert.equal(result.decision, "RESUME");
  assert.equal(result.requiresApproval, true);
});

test("M24.22 reconciles negative or unverified learning", () => {
  const result = evaluateRecoveryDecision(state({}, {
    lessonType: "NEGATIVE_DELTA",
    quality: "NEGATIVE",
    lesson: "recovery failed",
    reason: "checkpoint diverged",
  }));
  assert.equal(result.decision, "RECONCILE");
  assert.equal(result.requiresApproval, true);
});

test("M24.22 reconciles inconsistent stream identity", () => {
  const broken = state();
  broken.checkpoint.streamKey = "other-stream";
  const result = evaluateRecoveryDecision(broken);
  assert.equal(result.decision, "RECONCILE");
  assert.equal(result.checks.find((check) => check.name === "CONSISTENCY")?.passed, false);
});

test("M24.22 engine returns null when recovery is absent", async () => {
  const engine = new RecoveryDecisionEngine(
    new RecoveryStateReconstructor(new InMemoryRecoveryRead()),
  );
  assert.equal(await engine.decide("tenant-1", "missing"), null);
});

test("M24.22 validates decision query", async () => {
  await assert.rejects(
    () => decideRecovery("", "broker-1", {
      decide: async () => null,
    }),
    /RECOVERY_DECISION_QUERY_INVALID/,
  );
});
