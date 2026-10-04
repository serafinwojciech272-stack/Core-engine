import { createHash } from "node:crypto";
import type { PersistedEscalationEvidence } from "@/lib/m24-32-escalation-evidence-persistence";
import type { EscalationReconciliationResult } from "@/lib/m24-34-escalation-reconciliation";
import type { RecoveryClosureResult } from "@/lib/m24-35-recovery-closure";
import type { RecoveryTerminalControlResult } from "@/lib/m24-36-terminal-control-plane";
import type { RecoveryCertificationResult } from "@/lib/m24-37-recovery-certification";

export type RecoveryCertificationEvidenceChainInput = {
  evidence: PersistedEscalationEvidence;
  expectedDecisionHash: string;
  reconciliation: EscalationReconciliationResult;
  closure: RecoveryClosureResult;
  terminal: RecoveryTerminalControlResult;
  certification: RecoveryCertificationResult;
};

export type RecoveryCertificationEvidenceChainResult = {
  valid: boolean;
  chainHash: string | null;
  state: "CHAINED" | "BLOCKED";
  failures: string[];
  hashes: {
    evidenceHash: string | null;
    evidenceDecisionHash: string | null;
    reconciliationHash: string | null;
    closureHash: string | null;
    terminalHash: string | null;
    certificationHash: string | null;
  };
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildRecoveryCertificationEvidenceChain(
  input: RecoveryCertificationEvidenceChainInput,
): RecoveryCertificationEvidenceChainResult {
  const failures: string[] = [];

  if (!input.evidence) failures.push("EVIDENCE_MISSING");
  if (!input.evidence?.verified) failures.push("EVIDENCE_NOT_VERIFIED");
  if (!input.evidence?.evidence?.evidenceHash) failures.push("EVIDENCE_HASH_MISSING");
  if (input.evidence?.decisionHash !== input.expectedDecisionHash) failures.push("EVIDENCE_DECISION_HASH_MISMATCH");
  if (!input.reconciliation.reconciled) failures.push("RECONCILIATION_NOT_PASSED");
  if (!input.closure.closable || input.closure.state !== "CLOSE_READY") failures.push("CLOSURE_NOT_READY");
  if (!input.terminal.terminal || input.terminal.state !== "CLOSED") failures.push("TERMINAL_NOT_CLOSED");
  if (!input.certification.certified || input.certification.state !== "CERTIFIED" || !input.certification.certificationHash) {
    failures.push("CERTIFICATION_NOT_VALID");
  }

  const uniqueFailures = [...new Set(failures)];
  if (uniqueFailures.length > 0) {
    return {
      valid: false,
      chainHash: null,
      state: "BLOCKED",
      failures: uniqueFailures,
      hashes: {
        evidenceHash: null,
        evidenceDecisionHash: null,
        reconciliationHash: null,
        closureHash: null,
        terminalHash: null,
        certificationHash: input.certification.certificationHash,
      },
    };
  }

  const evidenceHash = input.evidence.evidence.evidenceHash;
  const evidenceDecisionHash = hash({
    decisionHash: input.evidence.decisionHash,
    expectedDecisionHash: input.expectedDecisionHash,
  });
  const reconciliationHash = hash(input.reconciliation);
  const closureHash = hash(input.closure);
  const terminalHash = hash(input.terminal);
  const certificationHash = input.certification.certificationHash!;

  const chainHash = hash({
    evidenceHash,
    evidenceDecisionHash,
    reconciliationHash,
    closureHash,
    terminalHash,
    certificationHash,
  });

  return {
    valid: true,
    chainHash,
    state: "CHAINED",
    failures: [],
    hashes: {
      evidenceHash,
      evidenceDecisionHash,
      reconciliationHash,
      closureHash,
      terminalHash,
      certificationHash,
    },
  };
}

export function verifyRecoveryCertificationEvidenceChain(
  input: RecoveryCertificationEvidenceChainInput,
  expectedChainHash: string,
): RecoveryCertificationEvidenceChainResult {
  const result = buildRecoveryCertificationEvidenceChain(input);
  if (!result.valid || !result.chainHash) return result;

  if (result.chainHash !== expectedChainHash) {
    return {
      ...result,
      valid: false,
      chainHash: null,
      state: "BLOCKED",
      failures: ["CERTIFICATION_CHAIN_HASH_MISMATCH"],
    };
  }

  return result;
}
