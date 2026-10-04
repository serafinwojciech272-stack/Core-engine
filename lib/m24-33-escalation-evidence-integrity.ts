import type { PersistedEscalationEvidence } from "@/lib/m24-32-escalation-evidence-persistence";

export type EscalationEvidenceIntegrityResult = {
  valid: boolean;
  approvalAllowed: boolean;
  checks: string[];
  failures: string[];
};

export function verifyPersistedEscalationEvidence(
  evidence: PersistedEscalationEvidence | null | undefined,
  expectedDecisionHash: string,
): EscalationEvidenceIntegrityResult {
  const checks: string[] = [];
  const failures: string[] = [];
  if (!evidence) failures.push("EVIDENCE_MISSING");
  else {
    if (evidence.decisionHash === expectedDecisionHash) checks.push("DECISION_HASH_MATCH");
    else failures.push("DECISION_HASH_MISMATCH");
    if (evidence.verified) checks.push("EVIDENCE_VERIFIED");
    else failures.push("EVIDENCE_NOT_VERIFIED");
    if (evidence.evidence?.evidenceHash) checks.push("EVIDENCE_HASH_PRESENT");
    else failures.push("EVIDENCE_HASH_MISSING");
    if (evidence.approvalAllowed && evidence.verified && failures.length === 0) checks.push("APPROVAL_SAFE");
    else if (evidence.approvalAllowed) failures.push("APPROVAL_FLAG_INCONSISTENT");
  }
  return { valid: failures.length === 0, approvalAllowed: failures.length === 0 && Boolean(evidence?.approvalAllowed), checks, failures };
}
