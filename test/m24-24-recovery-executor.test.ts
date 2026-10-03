import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryRecoveryExecutor, ExecutionPermissionDeniedError } from "@/lib/recovery-executor";

test("M24.24 denies execution without granted permission", async () => {
  const executor = new InMemoryRecoveryExecutor();
  await assert.rejects(() => executor.execute({
    tenantId: "tenant-1",
    recoveryKey: "recovery-1",
    permission: {
      approvalId: "approval-1",
      tenantId: "tenant-1",
      recoveryKey: "recovery-1",
      decision: "REPLAY",
      action: "REJECT",
      executionPermission: "DENIED",
      approvedBy: "human-1",
      approvedAt: new Date().toISOString(),
      decisionHash: "hash",
    },
    checkpoint: { cursor: "1" },
    idempotencyKey: "execution-1",
  }), ExecutionPermissionDeniedError);
});

test("M24.24 executes only an approved actionable recovery", async () => {
  const executor = new InMemoryRecoveryExecutor();
  const permission = {
    approvalId: "approval-1",
    tenantId: "tenant-1",
    recoveryKey: "recovery-1",
    decision: "RESUME" as const,
    action: "APPROVE" as const,
    executionPermission: "GRANTED" as const,
    approvedBy: "human-1",
    approvedAt: new Date().toISOString(),
    decisionHash: "hash",
  };
  const event = await executor.execute({ tenantId: "tenant-1", recoveryKey: "recovery-1", permission, checkpoint: { cursor: "2" }, idempotencyKey: "execution-1" });
  assert.equal(event.status, "EXECUTED");
  assert.equal(event.action, "RESUME");
  assert.equal(event.approvalId, "approval-1");
});
