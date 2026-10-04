export type RecoveryTerminalClosureInput = {
  tenantId: string;
  recoveryKey: string;
  approvalPermission: "GRANTED" | "DENIED";
  executionPermission: "GRANTED" | "DENIED";
  verificationPassed: boolean;
  learningPromoted: boolean;
  reconciliationPassed: boolean;
};

export type RecoveryTerminalClosureResult = {
  terminal: boolean;
  state: "CLOSED" | "CLOSE_BLOCKED";
  closureHash: string;
  failures: string[];
};

import { createHash } from "node:crypto";

export function evaluateTerminalRecoveryClosure(
  input: RecoveryTerminalClosureInput,
): RecoveryTerminalClosureResult {
  const failures: string[] = [];
  if (!input.tenantId || !input.recoveryKey) failures.push("RECOVERY_SCOPE_MISSING");
  if (input.approvalPermission !== "GRANTED") failures.push("APPROVAL_NOT_GRANTED");
  if (input.executionPermission !== "GRANTED") failures.push("EXECUTION_NOT_GRANTED");
  if (!input.reconciliationPassed) failures.push("RECONCILIATION_NOT_PASSED");
  if (!input.verificationPassed) failures.push("POST_EXECUTION_VERIFICATION_FAILED");
  if (!input.learningPromoted) failures.push("LEARNING_NOT_PROMOTED");

  const canonical = JSON.stringify({
    tenantId: input.tenantId,
    recoveryKey: input.recoveryKey,
    approvalPermission: input.approvalPermission,
    executionPermission: input.executionPermission,
    verificationPassed: input.verificationPassed,
    learningPromoted: input.learningPromoted,
    reconciliationPassed: input.reconciliationPassed,
    failures,
  });

  const closureHash = createHash("sha256").update(canonical).digest("hex");
  return {
    terminal: failures.length === 0,
    state: failures.length === 0 ? "CLOSED" : "CLOSE_BLOCKED",
    closureHash,
    failures,
  };
}
