import { describe, expect, it } from "vitest";
import { verifyRecoveryExecution } from "@/lib/m24-25-verification-engine";

const execution = {
  executionId: "e1",
  tenantId: "t1",
  recoveryKey: "r1",
  action: "RESUME" as const,
  status: "EXECUTED" as const,
  approvalId: "a1",
  decisionHash: "d1",
  executionHash: "x1",
  executedBy: "human-1",
  executedAt: "2026-10-03T00:00:00.000Z",
};

describe("M24.25", () => {
  it("success produces positive learning and a distinct verification hash", () => {
    const r = verifyRecoveryExecution({
      tenantId: "t1", recoveryKey: "r1", execution,
      expectedState: { cursor: "10", status: "ready" },
      observedState: { cursor: "10", status: "ready" },
    });
    expect(r.outcome).toBe("SUCCESS");
    expect(r.learningSignal).toBe("POSITIVE");
    expect(r.verificationHash).not.toBe(execution.executionHash);
  });

  it("partial produces negative learning", () => {
    const r = verifyRecoveryExecution({
      tenantId: "t1", recoveryKey: "r1", execution,
      expectedState: { cursor: "10", status: "ready" },
      observedState: { cursor: "10", status: "paused" },
    });
    expect(r.outcome).toBe("PARTIAL");
    expect(r.learningSignal).toBe("NEGATIVE");
    expect(r.matchedKeys).toEqual(["cursor"]);
    expect(r.mismatchedKeys).toEqual(["status"]);
  });

  it("scope is enforced", () => {
    expect(() => verifyRecoveryExecution({
      tenantId: "t2", recoveryKey: "r1", execution,
      expectedState: {}, observedState: {},
    })).toThrow("RECOVERY_VERIFICATION_SCOPE_MISMATCH");
  });

  it("non-executed events cannot produce outcome", () => {
    expect(() => verifyRecoveryExecution({
      tenantId: "t1", recoveryKey: "r1",
      execution: { ...execution, status: "FAILED" },
      expectedState: {}, observedState: {},
    })).toThrow("RECOVERY_EXECUTION_NOT_EXECUTED");
  });
});
