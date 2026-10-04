export type RecoveryClosureInput = {
  approvalPermission: "GRANTED" | "DENIED";
  executionPermission: "GRANTED" | "DENIED";
  verificationPassed: boolean;
  learningPromoted: boolean;
};

export type RecoveryClosureResult = {
  closable: boolean;
  state: "CLOSE_READY" | "CLOSE_BLOCKED";
  failures: string[];
};

export function evaluateRecoveryClosure(input: RecoveryClosureInput): RecoveryClosureResult {
  const failures: string[] = [];
  if (input.approvalPermission !== "GRANTED") failures.push("APPROVAL_NOT_GRANTED");
  if (input.executionPermission !== "GRANTED") failures.push("EXECUTION_NOT_GRANTED");
  if (!input.verificationPassed) failures.push("POST_EXECUTION_VERIFICATION_FAILED");
  if (!input.learningPromoted) failures.push("LEARNING_NOT_PROMOTED");
  return { closable: failures.length === 0, state: failures.length === 0 ? "CLOSE_READY" : "CLOSE_BLOCKED", failures };
}
