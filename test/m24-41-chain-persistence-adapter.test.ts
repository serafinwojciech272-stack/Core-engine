import test from "node:test";
import assert from "node:assert/strict";
import { verifyPersistedEscalationEvidence } from "@/lib/m24-33-escalation-evidence-integrity";
import { reconcileEscalationControl } from "@/lib/m24-34-escalation-reconciliation";
import { evaluateRecoveryClosure } from "@/lib/m24-35-recovery-closure";
import { finalizeRecoveryTerminalControl } from "@/lib/m24-36-terminal-control-plane";
import { certifyRecoveryClosure } from "@/lib/m24-37-recovery-certification";
import { buildRecoveryCertificationEvidenceChain } from "@/lib/m24-39-certification-evidence-chain";
import { persistReadReplayRecoveryCertificationChain } from "@/lib/m24-41-chain-persistence-adapter";
import type { RecoveryCertificationChainRecord } from "@/lib/m24-40-certification-chain-replay";

const evidence = {
  evidenceId: "e41", tenantId: "11111111-1111-1111-1111-111111111111", recoveryKey: "r41", idempotencyKey: "i41", decisionHash: "d41",
  level: "STANDARD_APPROVAL" as const, verified: true, approvalAllowed: true,
  evidence: { evidenceHash: "e41-hash", verifiedAt: "2026-10-05T00:00:00.000Z", checks: ["POLICY"], failures: [] },
  createdAt: "2026-10-05T00:00:00.000Z",
};

function buildRecord(): RecoveryCertificationChainRecord {
  const integrity = verifyPersistedEscalationEvidence(evidence, "d41");
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
    tenantId: evidence.tenantId,
    recoveryKey: evidence.recoveryKey,
    idempotencyKey: evidence.idempotencyKey,
    terminal,
    verifiedAt: "2026-10-05T00:00:00.000Z",
  });
  const chainPayload = {
    evidence, expectedDecisionHash: "d41", reconciliation, closure, terminal, certification,
  };
  const chain = buildRecoveryCertificationEvidenceChain(chainPayload);
  assert.equal(chain.valid, true);

  return {
    tenantId: evidence.tenantId,
    recoveryKey: evidence.recoveryKey,
    idempotencyKey: evidence.idempotencyKey,
    evidenceHash: chain.hashes.evidenceHash!,
    evidenceDecisionHash: chain.hashes.evidenceDecisionHash!,
    reconciliationHash: chain.hashes.reconciliationHash!,
    closureHash: chain.hashes.closureHash!,
    terminalHash: chain.hashes.terminalHash!,
    certificationHash: chain.hashes.certificationHash!,
    chainHash: chain.chainHash!,
    chainPayload,
    chainedAt: "2026-10-05T00:00:00.000Z",
  };
}

function memoryPersistence() {
  let stored: RecoveryCertificationChainRecord | null = null;
  return {
    persist: async (record: RecoveryCertificationChainRecord) => {
      stored ??= structuredClone(record);
      if (stored.chainHash !== record.chainHash || JSON.stringify(stored.chainPayload) !== JSON.stringify(record.chainPayload)) {
        throw new Error("RECOVERY_CHAIN_IDEMPOTENCY_CONFLICT");
      }
      return structuredClone(stored);
    },
    read: async () => (stored ? structuredClone(stored) : null),
  };
}

test("M24.41 persist -> read -> replay returns verified integrity", async () => {
  const result = await persistReadReplayRecoveryCertificationChain(buildRecord(), memoryPersistence());
  assert.equal(result.valid, true);
  assert.equal(result.state, "REPLAY_VERIFIED");
  assert.deepEqual(result.failures, []);
});

test("M24.41 repeated persistence is idempotent", async () => {
  const persistence = memoryPersistence();
  const record = buildRecord();
  const first = await persistReadReplayRecoveryCertificationChain(record, persistence);
  const second = await persistReadReplayRecoveryCertificationChain(record, persistence);
  assert.equal(first.valid, true);
  assert.deepEqual(second, first);
});

test("M24.41 blocks when read-back disappears", async () => {
  const persistence = {
    persist: async (record: RecoveryCertificationChainRecord) => record,
    read: async () => null,
  };
  const result = await persistReadReplayRecoveryCertificationChain(buildRecord(), persistence);
  assert.equal(result.valid, false);
  assert.deepEqual(result.failures, ["CERTIFICATION_CHAIN_READBACK_MISSING"]);
});

test("M24.41 blocks tampering between persist and read", async () => {
  const record = buildRecord();
  const persistence = {
    persist: async (value: RecoveryCertificationChainRecord) => value,
    read: async () => ({ ...record, terminalHash: "0".repeat(64) }),
  };
  const result = await persistReadReplayRecoveryCertificationChain(record, persistence);
  assert.equal(result.valid, false);
  assert.equal(result.state, "REPLAY_BLOCKED");
  assert.ok(result.failures.includes("PERSISTED_TERMINAL_HASH_MISMATCH"));
});
