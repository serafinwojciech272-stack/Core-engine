import { describe, expect, it } from "vitest";
import { buildGrowthMissionPlan, canExecuteGrowthAction } from "@/lib/growth-mission";

describe("growth mission execution fabric", () => {
  it("binds capabilities to the existing mission approval gate", () => {
    const plan = buildGrowthMissionPlan({
      missionId: "m1",
      objective: "Improve website security",
      diagnosis: "Vulnerabilities need remediation",
      recommendation: "Harden security",
      signals: ["security vulnerability"]
    });
    expect(plan.missionId).toBe("m1");
    expect(plan.approvalGate).toBe("REQUIRED");
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(canExecuteGrowthAction(plan, plan.actions[0].id, "AWAITING_APPROVAL").allowed).toBe(false);
  });

  it("allows only approved, non-blocked capability actions", () => {
    const plan = buildGrowthMissionPlan({
      missionId: "m2",
      objective: "Improve SEO",
      diagnosis: "Organic search visibility is weak",
      recommendation: "Optimize SEO",
      signals: ["organic search"]
    });
    const action = plan.actions.find(a => a.id === "seo.audit");
    expect(action).toBeTruthy();
    expect(canExecuteGrowthAction(plan, "seo.audit", "APPROVED").allowed).toBe(true);
  });
});
