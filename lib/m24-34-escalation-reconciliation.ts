import type { PersistedEscalationEvidence } from "@/lib/m24-32-escalation-evidence-persistence";
import type { EscalationEvidenceIntegrityResult } from "@/lib/m24-33-escalation-evidence-integrity";

export type EscalationReconciliationResult = {
  reconciled: boolean;
  executionPermission: "GRANTED" | "DENIED";
  status: "READY_FOR_EXECUTION" | "BLOCKED";
  failures: string[];
};

export function reconcileEscalationControl(
  evidence: PersistedEscalationEvidence | null | undefined,
  integrity: EscalationEvidenceIntegrityResult,
  approvalExecutionPermission: "GRANTED" | "DENIED",
): EscalationReconciliationResult {
  const failures: string[] = [];
  if (!evidence) failures.push("EVIDENCE_MISSING");
  if (!integrity.valid || !integrity.approvalAllowed) failures.push(...integrity.failures);
  if (approvalExecutionPermission !== "GRANTED") failures.push("APPROVAL_PERMISSION_DENIED");
  const uniqueFailures = [...new Set(failures)];
  const reconciled = uniqueFailures.length === 0;
  return {
    reconciled,
    executionPermission: reconciled ? "GRANTED" : "DENIED",
    status: reconciled ? "READY_FOR_EXECUTION" : "BLOCKED",
    failures: uniqueFailures,
  };
}
