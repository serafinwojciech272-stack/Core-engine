import { describe, expect, it } from "vitest";
import { evaluateApprovalRequest } from "@/lib/recovery-approval-gate";

const decision = {
  tenantId: "tenant-a",
  recoveryKey: "recovery-1",
  commitId: "commit-1",
  payloadHash: "hash-1",
  decision: "RESUME" as const,
  reasons: ["policy"],
  checks: [{ name: "POLICY" as const, passed: true, reason: "policy supports RESUME" }],
  requiresApproval: true,
  evaluatedAt: "2026-10-04T00:00:00.000Z",
  source: "RECOVERY_STATE + LEARNING_POLICY" as const,
  policySource: "LEARNING_POLICY" as const,
  selectedPolicy: {
    tenantId: "tenant-a",
    recoveryKey: "recovery-1",
    action: "RESUME" as const,
    sampleCount: 5,
    successCount: 5,
    partialCount: 0,
    failedCount: 0,
    unverifiedCount: 0,
    netWeight: 5,
    confidenceBps: 10000,
    policyVersion: 5,
    source: "PROMOTED_LEARNING" as const,
    aggregatedAt: "2026-10-04T00:00:00.000Z",
  },
  candidatePolicies: [],
  policyAdjusted: true,
};

describe("M24.29 policy-weighted approval gate", () => {
  it("marks high-confidence positive policy as POLICY_SUPPORTED", () => {
    const result = evaluateApprovalRequest({
      tenantId: "tenant-a", recoveryKey: "recovery-1", decision,
      action: "APPROVE", actorId: "human-1", actorKind: "human",
      idempotencyKey: "idem-1", policyWeight: { netWeight: 5, confidenceBps: 10000, sampleCount: 5, policyVersion: 5 },
    });
    expect(result.executionPermission).toBe("GRANTED");
    expect(result.approvalTier).toBe("POLICY_SUPPORTED");
  });

  it("keeps approval explicit when policy is unsupported", () => {
    const result = evaluateApprovalRequest({
      tenantId: "tenant-a", recoveryKey: "recovery-1", decision,
      action: "APPROVE", actorId: "human-1", actorKind: "human",
      idempotencyKey: "idem-2", policyWeight: { netWeight: -1, confidenceBps: 4000, sampleCount: 2, policyVersion: 2 },
    });
    expect(result.executionPermission).toBe("GRANTED");
    expect(result.approvalTier).toBe("POLICY_UNSUPPORTED");
  });

  it("never grants permission on rejection", () => {
    const result = evaluateApprovalRequest({
      tenantId: "tenant-a", recoveryKey: "recovery-1", decision,
      action: "REJECT", actorId: "human-1", actorKind: "human",
      idempotencyKey: "idem-3", policyWeight: { netWeight: 5, confidenceBps: 10000, sampleCount: 5, policyVersion: 5 },
    });
    expect(result.executionPermission).toBe("DENIED");
  });
});
