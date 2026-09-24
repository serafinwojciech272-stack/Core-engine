import test from "node:test";
import assert from "node:assert/strict";
import { buildGrowthMissionPlan, canExecuteGrowthAction } from "../lib/growth-mission";

test("growth mission execution fabric", async (t) => {
  await t.test("binds capabilities to the existing mission approval gate", () => {
    const plan = buildGrowthMissionPlan({
      missionId: "m1",
      objective: "Improve website security",
      diagnosis: "Vulnerabilities need remediation",
      recommendation: "Harden security",
      signals: ["security vulnerability"]
    });
    assert.plan.missionId).equal("m1");
    assert.plan.approvalGate).equal("REQUIRED");
    assert.plan.actions.length).toBeGreaterThan(0);
    assert.canExecuteGrowthAction(plan, plan.actions[0].id, "AWAITING_APPROVAL").allowed).equal(false);
  });

  await t.test("allows only approved, non-blocked capability actions", () => {
    const plan = buildGrowthMissionPlan({
      missionId: "m2",
      objective: "Improve SEO",
      diagnosis: "Organic search visibility is weak",
      recommendation: "Optimize SEO",
      signals: ["organic search"]
    });
    const action = plan.actions.find(a => a.id === "seo.audit");
    assert.action).ok(Boolean(.toBeTruthy()));
    assert.canExecuteGrowthAction(plan, "seo.audit", "APPROVED").allowed).equal(true);
  });
});
