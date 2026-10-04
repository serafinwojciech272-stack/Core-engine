import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateApprovalRequest,
  InMemoryRecoveryApprovalGate,
  type RecoveryApprovalRequest,
} from "@/lib/recovery-approval-gate";

const decision = {
  tenantId: "tenant-1",
  recoveryKey: "broker-1",
  commitId: "commit-1",
  payloadHash: "hash-1",
  decision: "REPLAY" as const,
  reasons: ["Checkpoint explicitly requires replay."],
  checks: [],
  requiresApproval: true,
  evaluatedAt: "2026-10-03T13:00:00.000Z",
  source: "RECOVERY_STATE" as const,
};

function request(action: "APPROVE" | "REJECT", idempotencyKey = "approval-1"): RecoveryApprovalRequest {
  return {
    tenantId: "tenant-1",
    recoveryKey: "broker-1",
    decision,
    action,
    actorId: "api-key",
    actorKind: "human",
    idempotencyKey,
    reason: action === "REJECT" ? "operator rejected replay" : null,
  };
}

test("M24.23 grants execution permission only after human approval", () => {
  const result = evaluateApprovalRequest(request("APPROVE"));
  assert.equal(result.status, "APPROVED");
  assert.equal(result.executionPermission, "GRANTED");
  assert.equal(result.decisionHash.length, 64);
});

test("M24.23 rejection never grants execution permission", () => {
  const result = evaluateApprovalRequest(request("REJECT"));
  assert.equal(result.status, "REJECTED");
  assert.equal(result.executionPermission, "DENIED");
});

test("M24.23 NO_ACTION never receives execution permission", () => {
  const result = evaluateApprovalRequest(request("APPROVE"));
  const noAction = evaluateApprovalRequest({
    ...request("APPROVE", "approval-no-action"),
    decision: { ...decision, decision: "NO_ACTION", requiresApproval: false },
  });
  assert.equal(result.executionPermission, "GRANTED");
  assert.equal(noAction.executionPermission, "DENIED");
});

test("M24.23 idempotency returns the same approval", async () => {
  const gate = new InMemoryRecoveryApprovalGate();
  const first = await gate.approve(request("APPROVE"));
  const second = await gate.approve(request("APPROVE"));
  assert.equal(first.approvalId, second.approvalId);
  assert.equal(second.status, "IDEMPOTENT");
});

test("M24.23 scope mismatch is rejected", () => {
  assert.throws(() => evaluateApprovalRequest({
    ...request("APPROVE"),
    recoveryKey: "other",
  }), /RECOVERY_APPROVAL_DECISION_SCOPE_MISMATCH/);
});

test("M24.23 baseline recovery decisions remain executable only after approval",()=>{
 const result=evaluateApprovalRequest(request("APPROVE"));
 assert.equal(result.executionPermission,"GRANTED");
 assert.equal(result.escalationVerification.approvalAllowed,true);
});
