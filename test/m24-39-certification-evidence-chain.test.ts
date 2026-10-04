import test from "node:test";
import assert from "node:assert/strict";
import { verifyPersistedEscalationEvidence } from "@/lib/m24-33-escalation-evidence-integrity";
import { reconcileEscalationControl } from "@/lib/m24-34-escalation-reconciliation";
import { evaluateRecoveryClosure } from "@/lib/m24-35-recovery-closure";
import { finalizeRecoveryTerminalControl } from "@/lib/m24-36-terminal-control-plane";
import { certifyRecoveryClosure } from "@/lib/m24-37-recovery-certification";
import {
  buildRecoveryCertificationEvidenceChain,
  verifyRecoveryCertificationEvidenceChain,
} from "@/lib/m24-39-certification-evidence-chain";

const evidence = {
  evidenceId: "e1", tenantId: "t1", recoveryKey: "r1", idempotencyKey: "i1", decisionHash: "d1",
  level: "STANDARD_APPROVAL" as const, verified: true, approvalAllowed: true,
  evidence: { evidenceHash: "e1-hash", verifiedAt: "2026-10-04T00:00:00.000Z", checks: ["POLICY"], failures: [] },
  createdAt: "2026-10-04T00:00:00.000Z",
};

function buildChainInput() {
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
    tenantId: "t1",
    recoveryKey: "r1",
    idempotencyKey: "i1",
    terminal,
    verifiedAt: "2026-10-04T00:00:00.000Z",
  });
  return { evidence, expectedDecisionHash: "d1", reconciliation, closure, terminal, certification };
}

test("M24.39 chains M24.33 evidence through M24.35 closure, M24.36 terminal and M24.37 certification", () => {
  const result = buildRecoveryCertificationEvidenceChain(buildChainInput());

  assert.equal(result.valid, true);
  assert.equal(result.state, "CHAINED");
  assert.equal(result.chainHash?.length, 64);
  assert.deepEqual(result.failures, []);
  assert.equal(result.hashes.evidenceHash, "e1-hash");
  assert.equal(result.hashes.certificationHash?.length, 64);
});

test("M24.39 replay verifies the complete cross-stage chain", () => {
  const input = buildChainInput();
  const chain = buildRecoveryCertificationEvidenceChain(input);

  const result = verifyRecoveryCertificationEvidenceChain(input, chain.chainHash!);

  assert.equal(result.valid, true);
  assert.equal(result.state, "CHAINED");
  assert.equal(result.chainHash, chain.chainHash);
});

test("M24.39 blocks chain when M24.33 evidence is tampered", () => {
  const input = buildChainInput();
  input.evidence.evidence.evidenceHash = "tampered";

  const result = buildRecoveryCertificationEvidenceChain(input);

  assert.equal(result.valid, true);
  assert.equal(result.state, "CHAINED");
  assert.notEqual(result.chainHash, null);

  const original = buildChainInput();
  const expected = buildRecoveryCertificationEvidenceChain(original).chainHash!;
  const replay = verifyRecoveryCertificationEvidenceChain(input, expected);

  assert.equal(replay.valid, false);
  assert.equal(replay.state, "BLOCKED");
  assert.deepEqual(replay.failures, ["CERTIFICATION_CHAIN_HASH_MISMATCH"]);
});

test("M24.39 blocks chain when M24.35 closure is no longer ready", () => {
  const input = buildChainInput();
  input.closure.closable = false;
  input.closure.state = "CLOSE_BLOCKED";
  input.closure.failures = ["LEARNING_NOT_PROMOTED"];

  const result = buildRecoveryCertificationEvidenceChain(input);

  assert.equal(result.valid, false);
  assert.equal(result.state, "BLOCKED");
  assert.deepEqual(result.failures, ["CLOSURE_NOT_READY"]);
});

test("M24.39 blocks chain when M24.36 terminal state is reopened", () => {
  const input = buildChainInput();
  input.terminal.terminal = false;
  input.terminal.state = "BLOCKED";
  input.terminal.transitionAllowed = false;

  const result = buildRecoveryCertificationEvidenceChain(input);

  assert.equal(result.valid, false);
  assert.equal(result.state, "BLOCKED");
  assert.deepEqual(result.failures, ["TERMINAL_NOT_CLOSED"]);
});

test("M24.39 blocks replay when chain hash is changed", () => {
  const input = buildChainInput();
  const chain = buildRecoveryCertificationEvidenceChain(input);

  const result = verifyRecoveryCertificationEvidenceChain(input, "0".repeat(64));

  assert.equal(result.valid, false);
  assert.equal(result.state, "BLOCKED");
  assert.equal(result.chainHash, null);
  assert.deepEqual(result.failures, ["CERTIFICATION_CHAIN_HASH_MISMATCH"]);
  assert.notEqual(chain.chainHash, null);
});

test("M24.39 blocks chain when certification is invalid", () => {
  const input = buildChainInput();
  input.certification.certified = false;
  input.certification.state = "BLOCKED";
  input.certification.certificationHash = null;

  const result = buildRecoveryCertificationEvidenceChain(input);

  assert.equal(result.valid, false);
  assert.equal(result.state, "BLOCKED");
  assert.deepEqual(result.failures, ["CERTIFICATION_NOT_VALID"]);
});
