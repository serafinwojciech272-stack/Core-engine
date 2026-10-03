import { describe, expect, it } from "vitest";
import { promoteRecoveryLearning } from "@/lib/m24-26-learning-promotion-engine";

const base = {
  tenantId: "tenant-a",
  recoveryKey: "recovery-a",
  executionId: "execution-a",
  action: "RESUME" as const,
  learningSignal: "POSITIVE" as const,
  matchedKeys: ["status"],
  mismatchedKeys: [],
  verificationHash: "hash",
  verifiedAt: "2026-10-03T00:00:00.000Z",
  reason: "EXPECTED_STATE_MATCHED",
};

describe("M24.26 Recovery Learning Promotion", () => {
  it("promotes successful recovery learning into a positive policy update", () => {
    const result = promoteRecoveryLearning({ ...base, outcome: "SUCCESS" });
    expect(result.status).toBe("PROMOTED");
    expect(result.policyUpdate.weightDelta).toBe(1);
    expect(result.policyUpdate.confidenceBps).toBe(10000);
    expect(result.promotionHash).toHaveLength(64);
  });

  it("promotes failed learning as a negative policy signal", () => {
    const result = promoteRecoveryLearning({ ...base, outcome: "FAILED", learningSignal: "NEGATIVE" });
    expect(result.status).toBe("PROMOTED");
    expect(result.policyUpdate.weightDelta).toBe(-1);
  });

  it("does not promote unverified evidence", () => {
    const result = promoteRecoveryLearning({ ...base, outcome: "UNVERIFIED", learningSignal: "NEUTRAL" });
    expect(result.status).toBe("NO_PROMOTION");
    expect(result.policyUpdate.weightDelta).toBe(0);
  });
});
