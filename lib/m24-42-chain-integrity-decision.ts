import { createHash } from "node:crypto";
import type { RecoveryCertificationChainReplayResult } from "@/lib/m24-40-certification-chain-replay";

export type RecoveryCertificationChainIntegrityDecisionInput = {
  tenantId: string;
  recoveryKey: string;
  idempotencyKey: string;
  replay: RecoveryCertificationChainReplayResult;
};

export type RecoveryCertificationChainIntegrityDecision = {
  valid: boolean;
  decision: "INTEGRITY_CONFIRMED" | "INTEGRITY_BLOCKED";
  executionPermission: "GRANTED" | "BLOCKED";
  decisionHash: string | null;
  failures: string[];
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function uniqueFailures(failures: string[]): string[] {
  return [...new Set(failures)];
}

export function evaluateRecoveryCertificationChainIntegrity(
  input: RecoveryCertificationChainIntegrityDecisionInput,
): RecoveryCertificationChainIntegrityDecision {
  const failures: string[] = [];

  if (!input.tenantId) failures.push("CHAIN_DECISION_TENANT_MISSING");
  if (!input.recoveryKey) failures.push("CHAIN_DECISION_RECOVERY_KEY_MISSING");
  if (!input.idempotencyKey) failures.push("CHAIN_DECISION_IDEMPOTENCY_KEY_MISSING");

  if (!input.replay.valid || input.replay.state !== "REPLAY_VERIFIED") {
    failures.push("CERTIFICATION_CHAIN_REPLAY_NOT_VERIFIED");
    failures.push(...input.replay.failures);
  }

  if (input.replay.valid) {
    const replayed = input.replay.replayed;
    if (!replayed?.chainHash) failures.push("CERTIFICATION_CHAIN_REPLAY_HASH_MISSING");
    if (!replayed?.hashes.evidenceHash) failures.push("CERTIFICATION_CHAIN_EVIDENCE_HASH_MISSING");
    if (!replayed?.hashes.evidenceDecisionHash) failures.push("CERTIFICATION_CHAIN_DECISION_HASH_MISSING");
    if (!replayed?.hashes.reconciliationHash) failures.push("CERTIFICATION_CHAIN_RECONCILIATION_HASH_MISSING");
    if (!replayed?.hashes.closureHash) failures.push("CERTIFICATION_CHAIN_CLOSURE_HASH_MISSING");
    if (!replayed?.hashes.terminalHash) failures.push("CERTIFICATION_CHAIN_TERMINAL_HASH_MISSING");
    if (!replayed?.hashes.certificationHash) failures.push("CERTIFICATION_CHAIN_CERTIFICATION_HASH_MISSING");
  }

  const normalized = uniqueFailures(failures);
  if (normalized.length > 0) {
    return {
      valid: false,
      decision: "INTEGRITY_BLOCKED",
      executionPermission: "BLOCKED",
      decisionHash: null,
      failures: normalized,
    };
  }

  const replayed = input.replay.replayed!;
  const decisionHash = hash({
    tenantId: input.tenantId,
    recoveryKey: input.recoveryKey,
    idempotencyKey: input.idempotencyKey,
    chainHash: replayed.chainHash,
    evidenceHash: replayed.hashes.evidenceHash,
    evidenceDecisionHash: replayed.hashes.evidenceDecisionHash,
    reconciliationHash: replayed.hashes.reconciliationHash,
    closureHash: replayed.hashes.closureHash,
    terminalHash: replayed.hashes.terminalHash,
    certificationHash: replayed.hashes.certificationHash,
    decision: "INTEGRITY_CONFIRMED",
  });

  return {
    valid: true,
    decision: "INTEGRITY_CONFIRMED",
    executionPermission: "GRANTED",
    decisionHash,
    failures: [],
  };
}

export function verifyRecoveryCertificationChainIntegrityDecision(
  input: RecoveryCertificationChainIntegrityDecisionInput,
  expectedDecisionHash: string,
): RecoveryCertificationChainIntegrityDecision {
  const result = evaluateRecoveryCertificationChainIntegrity(input);
  if (!result.valid || !result.decisionHash) return result;

  if (result.decisionHash !== expectedDecisionHash) {
    return {
      ...result,
      valid: false,
      decision: "INTEGRITY_BLOCKED",
      executionPermission: "BLOCKED",
      decisionHash: null,
      failures: ["CERTIFICATION_CHAIN_DECISION_HASH_MISMATCH"],
    };
  }

  return result;
}
