import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRecoveryCertificationChainIntegrity, verifyRecoveryCertificationChainIntegrityDecision } from "@/lib/m24-42-chain-integrity-decision";
import type { RecoveryCertificationChainReplayResult } from "@/lib/m24-40-certification-chain-replay";

const verifiedReplay = {
  valid: true,
  state: "REPLAY_VERIFIED",
  failures: [],
  original: {
    valid: true,
    chainHash: "c".repeat(64),
    state: "CHAINED",
    failures: [],
    hashes: {
      evidenceHash: "e".repeat(64),
      evidenceDecisionHash: "d".repeat(64),
      reconciliationHash: "r".repeat(64),
      closureHash: "l".repeat(64),
      terminalHash: "t".repeat(64),
      certificationHash: "f".repeat(64),
    },
  },
  replayed: {
    valid: true,
    chainHash: "c".repeat(64),
    state: "CHAINED",
    failures: [],
    hashes: {
      evidenceHash: "e".repeat(64),
      evidenceDecisionHash: "d".repeat(64),
      reconciliationHash: "r".repeat(64),
      closureHash: "l".repeat(64),
      terminalHash: "t".repeat(64),
      certificationHash: "f".repeat(64),
    },
  },
} satisfies RecoveryCertificationChainReplayResult;

const input = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  recoveryKey: "r42",
  idempotencyKey: "i42",
  replay: verifiedReplay,
};

test("M24.42 grants integrity only for a verified replay", () => {
  const result = evaluateRecoveryCertificationChainIntegrity(input);
  assert.equal(result.valid, true);
  assert.equal(result.decision, "INTEGRITY_CONFIRMED");
  assert.equal(result.executionPermission, "GRANTED");
  assert.match(result.decisionHash!, /^[0-9a-f]{64}$/);
  assert.deepEqual(result.failures, []);
});

test("M24.42 blocks unverified replay and propagates evidence failures", () => {
  const result = evaluateRecoveryCertificationChainIntegrity({
    ...input,
    replay: {
      valid: false,
      state: "REPLAY_BLOCKED",
      failures: ["PERSISTED_TERMINAL_HASH_MISMATCH"],
      original: null,
      replayed: null,
    },
  });
  assert.equal(result.valid, false);
  assert.equal(result.decision, "INTEGRITY_BLOCKED");
  assert.equal(result.executionPermission, "BLOCKED");
  assert.ok(result.failures.includes("CERTIFICATION_CHAIN_REPLAY_NOT_VERIFIED"));
  assert.ok(result.failures.includes("PERSISTED_TERMINAL_HASH_MISMATCH"));
});

test("M24.42 blocks when a required chain hash is missing", () => {
  const result = evaluateRecoveryCertificationChainIntegrity({
    ...input,
    replay: {
      ...verifiedReplay,
      replayed: {
        ...verifiedReplay.replayed!,
        hashes: { ...verifiedReplay.replayed!.hashes, terminalHash: null },
      },
    },
  });
  assert.equal(result.valid, false);
  assert.equal(result.executionPermission, "BLOCKED");
  assert.ok(result.failures.includes("CERTIFICATION_CHAIN_TERMINAL_HASH_MISSING"));
});

test("M24.42 decision verification is deterministic", () => {
  const first = evaluateRecoveryCertificationChainIntegrity(input);
  const second = evaluateRecoveryCertificationChainIntegrity(input);
  assert.equal(first.decisionHash, second.decisionHash);
});

test("M24.42 blocks a tampered decision hash", () => {
  const result = verifyRecoveryCertificationChainIntegrityDecision(input, "0".repeat(64));
  assert.equal(result.valid, false);
  assert.equal(result.decision, "INTEGRITY_BLOCKED");
  assert.equal(result.executionPermission, "BLOCKED");
  assert.deepEqual(result.failures, ["CERTIFICATION_CHAIN_DECISION_HASH_MISMATCH"]);
});
