import { describe, expect, it } from "vitest";
import { executeCapabilityAction, getCapabilityAction } from "@/lib/capability-action-registry";

describe("capability action registry", () => {
  it("resolves registered actions", () => {
    expect(getCapabilityAction("seo.audit")?.packId).toBe("seo-suite");
  });

  it("requires explicit approval for critical actions", () => {
    const blocked = executeCapabilityAction({ actionId: "security.harden", approved: false });
    expect(blocked.status).toBe("APPROVAL_REQUIRED");

    const approved = executeCapabilityAction({ actionId: "security.harden", approved: true });
    expect(approved.status).toBe("EXECUTED");
    expect(approved.sideEffect).toBe(false);
  });

  it("rejects unknown actions", () => {
    expect(executeCapabilityAction({ actionId: "does.not.exist", approved: true }).status).toBe("NOT_FOUND");
  });
});
