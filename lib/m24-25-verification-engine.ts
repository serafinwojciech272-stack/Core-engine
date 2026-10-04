import { createHash } from "node:crypto";
import type { RecoveryExecutionEvent } from "@/lib/recovery-executor";
import type { VerificationOutcome, LearningSignal } from "@/lib/m24-25-verification-contract";

export type RecoveryVerificationInput = {
  tenantId: string;
  recoveryKey: string;
  execution: RecoveryExecutionEvent;
  expectedState: Record<string, unknown>;
  observedState: Record<string, unknown>;
};

export type RecoveryVerificationResult = {
  tenantId: string;
  recoveryKey: string;
  executionId: string;
  action: RecoveryExecutionEvent["action"];
  outcome: VerificationOutcome;
  learningSignal: LearningSignal;
  matchedKeys: string[];
  mismatchedKeys: string[];
  verificationHash: string;
  verifiedAt: string;
  reason: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function verifyRecoveryExecution(input: RecoveryVerificationInput): RecoveryVerificationResult {
  if (!input.tenantId || !input.recoveryKey || !input.execution.executionId) {
    throw new Error("RECOVERY_VERIFICATION_INPUT_INVALID");
  }
  if (input.execution.tenantId !== input.tenantId || input.execution.recoveryKey !== input.recoveryKey) {
    throw new Error("RECOVERY_VERIFICATION_SCOPE_MISMATCH");
  }
  if (input.execution.status !== "EXECUTED") {
    throw new Error("RECOVERY_EXECUTION_NOT_EXECUTED");
  }

  const keys = [...new Set([...Object.keys(input.expectedState), ...Object.keys(input.observedState)])].sort();
  const matchedKeys = keys.filter((key) => stable(input.expectedState[key]) === stable(input.observedState[key]));
  const mismatchedKeys = keys.filter((key) => stable(input.expectedState[key]) !== stable(input.observedState[key]));
  const outcome: VerificationOutcome =
    keys.length === 0 ? "UNVERIFIED" :
    mismatchedKeys.length === 0 ? "SUCCESS" :
    matchedKeys.length ? "PARTIAL" : "FAILED";
  const learningSignal: LearningSignal =
    outcome === "SUCCESS" ? "POSITIVE" :
    outcome === "UNVERIFIED" ? "NEUTRAL" : "NEGATIVE";

  const verificationHash = createHash("sha256").update(stable({
    executionHash: input.execution.executionHash,
    executionId: input.execution.executionId,
    expectedState: input.expectedState,
    observedState: input.observedState,
    outcome,
    matchedKeys,
    mismatchedKeys,
  })).digest("hex");

  return {
    tenantId: input.tenantId,
    recoveryKey: input.recoveryKey,
    executionId: input.execution.executionId,
    action: input.execution.action,
    outcome,
    learningSignal,
    matchedKeys,
    mismatchedKeys,
    verificationHash,
    verifiedAt: new Date().toISOString(),
    reason: outcome === "SUCCESS" ? "EXPECTED_STATE_MATCHED" :
      outcome === "PARTIAL" ? "EXPECTED_STATE_PARTIALLY_MATCHED" :
      outcome === "FAILED" ? "EXPECTED_STATE_MISMATCH" : "NO_VERIFIABLE_STATE",
  };
}
