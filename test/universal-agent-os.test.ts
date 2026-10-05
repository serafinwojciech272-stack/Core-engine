import { describe, expect, it } from "vitest";
import { buildUniversalAgentPlan } from "@/lib/universal-agent";
import {
  UAOS_STAGES,
  createUniversalAgentRun,
  approveUniversalAgentRun,
  advanceUniversalAgentRun,
  recoverUniversalAgentRun,
  replanUniversalAgentRun,
  selectUniversalAgentProvider,
  verifyUniversalAgentRun
} from "@/lib/universal-agent-os";

describe("M125+ Universal Agent Operating System", () => {
  it("defines the closed-loop runtime stages 125-135", () => {
    expect(UAOS_STAGES.map(s => s.id)).toEqual([125,126,127,128,129,130,131,132,133,134,135]);
  });

  it("keeps execution permission behind explicit approval", () => {
    const plan = buildUniversalAgentPlan({ objective: "Run a governed business analysis" });
    const run = createUniversalAgentRun(plan);
    expect(run.executionPermission).toBe(false);
    expect(run.status).toBe("CREATED");
    expect(() => advanceUniversalAgentRun(run)).toThrow("HUMAN_APPROVAL_REQUIRED");
  });

  it("creates an approved runtime and advances with evidence", () => {
    const plan = buildUniversalAgentPlan({ objective: "Build and verify a governed mission" });
    let run = approveUniversalAgentRun(createUniversalAgentRun(plan));
    expect(run.executionPermission).toBe(true);
    run = advanceUniversalAgentRun(run, ["approval-boundary-passed"]);
    expect(run.currentStage).toBe(128);
    expect(run.revision).toBeGreaterThan(1);
    expect(verifyUniversalAgentRun(run).approvalIntact).toBe(true);
  });

  it("supports recovery and replanning without granting new permission", () => {
    const plan = buildUniversalAgentPlan({ objective: "Recover safely" });
    const approved = approveUniversalAgentRun(createUniversalAgentRun(plan));
    const recovered = recoverUniversalAgentRun(approved, "provider timeout");
    expect(recovered.currentStage).toBe(131);
    const replanned = replanUniversalAgentRun(recovered, ["use fallback provider"]);
    expect(replanned.currentStage).toBe(130);
    expect(replanned.executionPermission).toBe(false);
  });

  it("routes to the highest scored available provider with deterministic fallbacks", () => {
    const routing = selectUniversalAgentProvider(
      [{ id: "primary", available: true, score: 70 }, { id: "fallback", available: true, score: 90 }, { id: "offline", available: false, score: 100 }],
      "build"
    );
    expect(routing.selected).toBe("fallback");
    expect(routing.fallbacks).toEqual(["primary"]);
  });
});
