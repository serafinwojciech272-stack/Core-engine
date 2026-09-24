import test from "node:test";
import assert from "node:assert/strict";
import { missions, events, approveCapabilityAction, isCapabilityApproved, claimCapabilityExecution } from "@/lib/engine";
import { executeCapabilityAction } from "@/lib/capability-action-registry";

test("capability action mission lifecycle tracks approval", () => {
  const missionId = "test-mission-approval";
  const key = "approval-1";
  const first = approveCapabilityAction(missionId, "security.harden", key);
  const duplicate = approveCapabilityAction(missionId, "security.harden", key);
  assert.equal(first, true);
  assert.equal(duplicate, false);
  assert.equal(isCapabilityApproved(missionId, "security.harden"), true);
});

test("capability execution is idempotent", async () => {
  const missionId = "test-mission-execution";
  const first = claimCapabilityExecution(missionId, "seo.audit", "exec-1");
  const duplicate = claimCapabilityExecution(missionId, "seo.audit", "exec-1");
  assert.equal(first, true);
  assert.equal(duplicate, false);
  const receipt = await executeCapabilityAction({ actionId: "seo.audit", approved: true });
  assert.equal(receipt.status, "EXECUTED");
  assert.equal(receipt.sideEffect, false);
});

test("preserves the single mission state machine", () => {
  assert.ok(missions);
  assert.ok(events);
  assert.equal(Array.isArray(events), true);
});
