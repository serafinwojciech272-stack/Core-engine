import {
  buildRecoveryCertificationEvidenceChain,
  type RecoveryCertificationEvidenceChainResult,
} from "@/lib/m24-39-certification-evidence-chain";
import type { RecoveryCertificationEvidenceChainInput } from "@/lib/m24-39-certification-evidence-chain";

export type RecoveryCertificationChainRecord = {
  tenantId: string;
  recoveryKey: string;
  idempotencyKey: string;
  evidenceHash: string;
  evidenceDecisionHash: string;
  reconciliationHash: string;
  closureHash: string;
  terminalHash: string;
  certificationHash: string;
  chainHash: string;
  chainPayload: RecoveryCertificationEvidenceChainInput;
  chainedAt: string;
};

export type RecoveryCertificationChainReplayResult =
  | {
      valid: true;
      state: "REPLAY_VERIFIED";
      failures: [];
      original: RecoveryCertificationEvidenceChainResult;
      replayed: RecoveryCertificationEvidenceChainResult;
    }
  | {
      valid: false;
      state: "REPLAY_BLOCKED";
      failures: string[];
      original: RecoveryCertificationEvidenceChainResult | null;
      replayed: RecoveryCertificationEvidenceChainResult | null;
    };

function uniqueFailures(failures: string[]): string[] {
  return [...new Set(failures)];
}

function compareHash(failures: string[], name: string, stored: string, computed: string | null): void {
  if (!computed || stored !== computed) failures.push(`PERSISTED_${name.toUpperCase()}_HASH_MISMATCH`);
}

export function replayPersistedRecoveryCertificationChain(
  record: RecoveryCertificationChainRecord | null | undefined,
): RecoveryCertificationChainReplayResult {
  if (!record) {
    return { valid: false, state: "REPLAY_BLOCKED", failures: ["CERTIFICATION_CHAIN_MISSING"], original: null, replayed: null };
  }

  const failures: string[] = [];
  const payload = record.chainPayload;

  if (!payload) failures.push("CERTIFICATION_CHAIN_PAYLOAD_MISSING");
  if (payload && payload.evidence.tenantId !== record.tenantId) failures.push("CERTIFICATION_CHAIN_TENANT_MISMATCH");
  if (payload && payload.evidence.recoveryKey !== record.recoveryKey) failures.push("CERTIFICATION_CHAIN_RECOVERY_KEY_MISMATCH");
  if (payload && payload.evidence.idempotencyKey !== record.idempotencyKey) failures.push("CERTIFICATION_CHAIN_IDEMPOTENCY_KEY_MISMATCH");

  if (failures.length > 0 || !payload) {
    return { valid: false, state: "REPLAY_BLOCKED", failures: uniqueFailures(failures), original: null, replayed: null };
  }

  const replayed = buildRecoveryCertificationEvidenceChain(payload);
  const original = replayed.valid ? replayed : null;

  compareHash(failures, "evidence", record.evidenceHash, replayed.hashes.evidenceHash);
  compareHash(failures, "evidence_decision", record.evidenceDecisionHash, replayed.hashes.evidenceDecisionHash);
  compareHash(failures, "reconciliation", record.reconciliationHash, replayed.hashes.reconciliationHash);
  compareHash(failures, "closure", record.closureHash, replayed.hashes.closureHash);
  compareHash(failures, "terminal", record.terminalHash, replayed.hashes.terminalHash);
  compareHash(failures, "certification", record.certificationHash, replayed.hashes.certificationHash);
  compareHash(failures, "chain", record.chainHash, replayed.chainHash);

  if (!replayed.valid) failures.push(...replayed.failures);

  const normalized = uniqueFailures(failures);
  if (normalized.length > 0) {
    return { valid: false, state: "REPLAY_BLOCKED", failures: normalized, original, replayed };
  }

  return { valid: true, state: "REPLAY_VERIFIED", failures: [], original, replayed };
}
