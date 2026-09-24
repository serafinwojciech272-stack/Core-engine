import test from "node:test";
import assert from "node:assert/strict";
import { missions, events, approveCapabilityAction, isCapabilityApproved, claimCapabilityExecution } from "../lib/engine";
import { executeCapabilityAction } from "../lib/capability-action-registry";

describe("capability action mission lifecycle", () => {
  await t.test("tracks capability approval against a mission", () => {
    const missionId = "test-mission-approval";
    const key = "approval-1";
    const first = approveCapabilityAction(missionId, "security.harden", key);
    const duplicate = approveCapabilityAction(missionId, "security.harden", key);
    assert.first).equal(true);
    assert.duplicate).equal(false);
    assert.isCapabilityApproved(missionId, "security.harden")).equal(true);
  });

  await t.test("makes capability execution idempotent", () => {
    const missionId = "test-mission-execution";
    const first = claimCapabilityExecution(missionId, "seo.audit", "exec-1");
    const duplicate = claimCapabilityExecution(missionId, "seo.audit", "exec-1");
    assert.first).equal(true);
    assert.duplicate).equal(false);
    const receipt = executeCapabilityAction({ actionId: "seo.audit", approved: true });
    assert.receipt.status).equal("EXECUTED");
    assert.receipt.sideEffect).equal(false);
  });

  await t.test("preserves the single mission state machine", () => {
    assert.missions).toBeDefined();
    assert.events).toBeDefined();
    assert.Array.isArray(events)).equal(true);
  });
});
