import test from "node:test";
import assert from "node:assert/strict";
import { getCapabilityAction } from "@/lib/capability-action-registry";
import { executeSkillMissionCapability } from "@/lib/skills/mission-execution-bridge";

test("skill mission bridge executes an approved capability through the governed lifecycle", async () => {
  const action = getCapabilityAction("page.generate");
  assert.ok(action, "page.generate capability must be registered");
  assert.equal(action.requiresApproval, true);

  const result = await executeSkillMissionCapability({
    action,
    missionId: "m11-bridge-test",
    tenantId: "test-tenant",
    idempotencyKey: "m11-bridge-approved",
    approved: true,
    approvedBy: "test",
  });

  assert.equal(result.receipt.status, "EXECUTED");
  assert.equal(result.receipt.sideEffectStatus, "NONE");
  assert.equal(result.lifecycle.state, "VERIFIED");
  assert.equal(result.lifecycle.execution.status, "EXECUTED");
  assert.equal(result.lifecycle.verification?.passed, true);
  assert.equal(result.lifecycle.memory, undefined);
  assert.equal(result.lifecycle.learning, undefined);
});

test("skill mission bridge fails closed before adapter execution without capability approval", async () => {
  const action = getCapabilityAction("page.generate");
  assert.ok(action, "page.generate capability must be registered");

  const result = await executeSkillMissionCapability({
    action,
    missionId: "m11-bridge-test",
    tenantId: "test-tenant",
    idempotencyKey: "m11-bridge-no-approval",
    approved: false,
  });

  assert.equal(result.receipt.status, "APPROVAL_REQUIRED");
  assert.equal(result.receipt.sideEffectStatus, "NONE");
  assert.equal(result.lifecycle.state, "REJECTED");
  assert.equal(result.lifecycle.execution.status, "NOT_EXECUTED");
  assert.equal(result.lifecycle.verification, undefined);
});
