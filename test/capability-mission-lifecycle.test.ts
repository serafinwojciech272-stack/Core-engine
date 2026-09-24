import { describe, expect, it } from "vitest";
import { missions, events, approveCapabilityAction, isCapabilityApproved, claimCapabilityExecution } from "@/lib/engine";
import { executeCapabilityAction } from "@/lib/capability-action-registry";

describe("capability action mission lifecycle", () => {
  it("tracks capability approval against a mission", () => {
    const missionId = "test-mission-approval";
    const key = "approval-1";
    const first = approveCapabilityAction(missionId, "security.harden", key);
    const duplicate = approveCapabilityAction(missionId, "security.harden", key);
    expect(first).toBe(true);
    expect(duplicate).toBe(false);
    expect(isCapabilityApproved(missionId, "security.harden")).toBe(true);
  });

  it("makes capability execution idempotent", () => {
    const missionId = "test-mission-execution";
    const first = claimCapabilityExecution(missionId, "seo.audit", "exec-1");
    const duplicate = claimCapabilityExecution(missionId, "seo.audit", "exec-1");
    expect(first).toBe(true);
    expect(duplicate).toBe(false);
    const receipt = executeCapabilityAction({ actionId: "seo.audit", approved: true });
    expect(receipt.status).toBe("EXECUTED");
    expect(receipt.sideEffect).toBe(false);
  });

  it("preserves the single mission state machine", () => {
    expect(missions).toBeDefined();
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
  });
});
