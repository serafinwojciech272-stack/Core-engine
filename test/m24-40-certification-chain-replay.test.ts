import test from "node:test";
import assert from "node:assert/strict";
import { verifyPersistedEscalationEvidence } from "@/lib/m24-33-escalation-evidence-integrity";
import { reconcileEscalationControl } from "@/lib/m24-34-escalation-reconciliation";
import { evaluateRecoveryClosure } from "@/lib/m24-35-recovery-closure";
import { finalizeRecoveryTerminalControl } from "@/lib/m24-36-terminal-control-plane";
import { certifyRecoveryClosure } from "@/lib/m24-37-recovery-certification";
import { buildRecoveryCertificationEvidenceChain } from "@/lib/m24-39-certification-evidence-chain";
import { replayPersistedRecoveryCertificationChain } from "@/lib/m24-40-certification-chain-replay";

const evidence = {
  evidenceId: "e1", tenantId: "t1", recoveryKey: "r1", idempotencyKey: "i1", decisionHash: "d1",
  level: "STANDARD_APPROVAL" as const, verified: true, approvalAllowed: true,
  evidence: { evidenceHash: "e1-hash", verifiedAt: "2026-10-04T00:00:00.000Z", checks: ["POLICY"], failures: [] },
  createdAt: "2026-10-04T00:00:00.000Z",
};

function buildRecord() {
  const integrity = verifyPersistedEscalationEvidence(evidence, "d1");
  const reconciliation = reconcileEscalationControl(evidence, integrity, "GRANTED");
  const closure = evaluateRecoveryClosure({
    approvalPermission: "GRANTED",
    executionPermission: reconciliation.executionPermission,
    verificationPassed: true,
    learningPromoted: true,
  });
  const terminal = finalizeRecoveryTerminalControl({
    evidenceVerified: integrity.valid,
    reconciliationPassed: reconciliation.reconciled,
    closure,
    requestedTransition: "CLOSE",
  });
  const certification = certifyRecoveryClosure({
    tenantId: "t1", recoveryKey: "r1", idempotencyKey: "i1",
    terminal, verifiedAt: "2026-10-04T00:00:00.000Z",
  });
  const chainPayload = {
    evidence, expectedDecisionHash: "d1", reconciliation, closure, terminal, certification,
  };
  const chain = buildRecoveryCertificationEvidenceChain(chainPayload);
  assert.equal(chain.valid, true);

  return {
    tenantId: "t1", recoveryKey: "r1", idempotencyKey: "i1",
    evidenceHash: chain.hashes.evidenceHash!,
    evidenceDecisionHash: chain.hashes.evidenceDecisionHash!,
    reconciliationHash: chain.hashes.reconciliationHash!,
    closureHash: chain.hashes.closureHash!,
    terminalHash: chain.hashes.terminalHash!,
    certificationHash: chain.hashes.certificationHash!,
    chainHash: chain.chainHash!,
    chainPayload,
    chainedAt: "2026-10-04T00:00:00.000Z",
  };
}

test("M24.40 verifies a persisted chain after read/replay", () => {
  const result = replayPersistedRecoveryCertificationChain(buildRecord());
  assert.equal(result.valid, true);
  assert.equal(result.state, "REPLAY_VERIFIED");
  assert.deepEqual(result.failures, []);
});

test("M24.40 is idempotent on repeated replay", () => {
  const record = buildRecord();
  const first = replayPersistedRecoveryCertificationChain(record);
  const second = replayPersistedRecoveryCertificationChain(record);
  assert.deepEqual(second, first);
});

for (const [field, failure] of [
  ["evidenceHash", "PERSISTED_EVIDENCE_HASH_MISMATCH"],
  ["evidenceDecisionHash", "PERSISTED_EVIDENCE_DECISION_HASH_MISMATCH"],
  ["reconciliationHash", "PERSISTED_RECONCILIATION_HASH_MISMATCH"],
  ["closureHash", "PERSISTED_CLOSURE_HASH_MISMATCH"],
  ["terminalHash", "PERSISTED_TERMINAL_HASH_MISMATCH"],
  ["certificationHash", "PERSISTED_CERTIFICATION_HASH_MISMATCH"],
  ["chainHash", "PERSISTED_CHAIN_HASH_MISMATCH"],
] as const) {
  test(`M24.40 blocks replay when persisted ${field} is tampered`, () => {
    const record = buildRecord();
    record[field] = "0".repeat(64);
    const result = replayPersistedRecoveryCertificationChain(record);
    assert.equal(result.valid, false);
    assert.equal(result.state, "REPLAY_BLOCKED");
    assert.ok(result.failures.includes(failure));
  });
}

test("M24.40 blocks missing chain", () => {
  const result = replayPersistedRecoveryCertificationChain(null);
  assert.equal(result.valid, false);
  assert.deepEqual(result.failures, ["CERTIFICATION_CHAIN_MISSING"]);
});

test("M24.40 blocks identity mismatch", () => {
  const record = buildRecord();
  record.tenantId = "wrong";
  const result = replayPersistedRecoveryCertificationChain(record);
  assert.equal(result.valid, false);
  assert.deepEqual(result.failures, ["CERTIFICATION_CHAIN_TENANT_MISMATCH"]);
});

test("M24.40 blocks tampered payload even when stored hashes are untouched", () => {
  const record = buildRecord();
  record.chainPayload.closure.closable = false;
  record.chainPayload.closure.state = "CLOSE_BLOCKED";
  const result = replayPersistedRecoveryCertificationChain(record);
  assert.equal(result.valid, false);
  assert.equal(result.state, "REPLAY_BLOCKED");
  assert.ok(result.failures.includes("PERSISTED_CLOSURE_HASH_MISMATCH"));
  assert.ok(result.failures.includes("PERSISTED_CHAIN_HASH_MISMATCH"));
});
