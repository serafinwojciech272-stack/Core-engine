import test from "node:test";
import assert from "node:assert/strict";
import { buildGrowthMissionPlan, canExecuteGrowthAction } from "../lib/growth-mission.ts";

test("growth mission execution fabric", async (t) => {
  await t.test("binds capabilities to the existing mission approval gate", () => {
    const plan = buildGrowthMissionPlan({
      missionId: "m1",
      objective: "Improve website security",
      diagnosis: "Vulnerabilities need remediation",
      recommendation: "Harden security",
      signals: ["security vulnerability"]
    });
    assert.equal(plan.missionId, "m1");
    assert.equal(plan.approvalGate, "REQUIRED");
    assert.ok(plan.actions.length > 0);
    assert.equal(canExecuteGrowthAction(plan, plan.actions[0].id, "AWAITING_APPROVAL").allowed, false);
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
    assert.ok(action);
    assert.equal(canExecuteGrowthAction(plan, "seo.audit", "APPROVED").allowed, true);
  });
});
