import type { RecoveryClosureResult } from "@/lib/m24-35-recovery-closure";

export type RecoveryTerminalControlInput = {
  evidenceVerified: boolean;
  reconciliationPassed: boolean;
  closure: RecoveryClosureResult;
  requestedTransition: "CLOSE";
};

export type RecoveryTerminalControlResult = {
  transitionAllowed: boolean;
  terminal: boolean;
  state: "CLOSED" | "BLOCKED";
  failures: string[];
};

export function finalizeRecoveryTerminalControl(
  input: RecoveryTerminalControlInput,
): RecoveryTerminalControlResult {
  const failures: string[] = [];

  if (!input.evidenceVerified) failures.push("EVIDENCE_NOT_VERIFIED");
  if (!input.reconciliationPassed) failures.push("RECONCILIATION_FAILED");
  if (!input.closure.closable) failures.push(...input.closure.failures);
  if (input.closure.state !== "CLOSE_READY") failures.push("CLOSURE_NOT_READY");
  if (input.requestedTransition !== "CLOSE") failures.push("UNSUPPORTED_TERMINAL_TRANSITION");

  const uniqueFailures = [...new Set(failures)];
  const allowed = uniqueFailures.length === 0;

  return {
    transitionAllowed: allowed,
    terminal: allowed,
    state: allowed ? "CLOSED" : "BLOCKED",
    failures: uniqueFailures,
  };
}
