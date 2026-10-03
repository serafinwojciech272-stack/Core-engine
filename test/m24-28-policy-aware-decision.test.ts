import { describe, expect, it } from "vitest";
import { evaluatePolicyAwareRecoveryDecision } from "@/lib/m24-28-policy-aware-decision-engine";
import type { RecoveryDecisionResult } from "@/lib/recovery-decision-engine";
import type { RecoveryLearningPolicy } from "@/lib/m24-27-learning-policy-contract";

const base: RecoveryDecisionResult = {
  tenantId: "tenant-a",
  recoveryKey: "recovery-1",
  commitId: "commit-1",
  payloadHash: "hash-1",
  decision: "RECONCILE",
  reasons: ["state is valid"],
  checks: [],
  requiresApproval: true,
  evaluatedAt: "2026-10-04T00:00:00.000Z",
  source: "RECOVERY_STATE",
};

const policy = (overrides: Partial<RecoveryLearningPolicy> = {}): RecoveryLearningPolicy => ({
  tenantId: "tenant-a",
  recoveryKey: "recovery-1",
  action: "RESUME",
  sampleCount: 4,
  successCount: 4,
  partialCount: 0,
  failedCount: 0,
  unverifiedCount: 0,
  netWeight: 4,
  confidenceBps: 10000,
  policyVersion: 4,
  source: "PROMOTED_LEARNING",
  aggregatedAt: "2026-10-04T00:00:00.000Z",
  ...overrides,
});

describe("M24.28 policy-aware recovery decision", () => {
  it("promotes a safe policy-supported action from RECONCILE", async () => {
    const result = await evaluatePolicyAwareRecoveryDecision(base, [policy()]);
    expect(result.decision).toBe("RESUME");
    expect(result.policyAdjusted).toBe(true);
    expect(result.selectedPolicy?.action).toBe("RESUME");
    expect(result.requiresApproval).toBe(true);
  });

  it("rejects low-confidence policy and keeps RECONCILE", async () => {
    const result = await evaluatePolicyAwareRecoveryDecision(base, [
      policy({ confidenceBps: 4999, netWeight: 10 }),
    ]);
    expect(result.decision).toBe("RECONCILE");
    expect(result.selectedPolicy).toBeNull();
  });

  it("selects the strongest eligible policy deterministically", async () => {
    const result = await evaluatePolicyAwareRecoveryDecision(base, [
      policy({ action: "REPLAY", netWeight: 2, confidenceBps: 9000 }),
      policy({ action: "RESUME", netWeight: 3, confidenceBps: 8000 }),
    ]);
    expect(result.decision).toBe("RESUME");
  });

  it("never auto-executes the selected action", async () => {
    const result = await evaluatePolicyAwareRecoveryDecision(base, [policy()]);
    expect(result.requiresApproval).toBe(true);
    expect(result.decision).not.toBe("NO_ACTION");
  });
});
