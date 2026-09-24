import test from "node:test";
import assert from "node:assert/strict";
import { planGrowthCapabilities } from "../lib/capability-planner";

test("growth capability planner", async (t) => {
  await t.test("builds a conversion growth plan from business signals", () => {
    const plan = planGrowthCapabilities({
      objective: "Increase qualified checkout completion",
      diagnosis: "Checkout dropoff is high while traffic is growing.",
      recommendation: "Optimize checkout and conversion tracking.",
      signals: ["checkout_dropoff 41%", "traffic +18%", "conversion_rate 2.8%"]
    });
    assert.plan.selectedPacks.length).toBeGreaterThan(0);
    assert.plan.selectedPacks.map(x => x.id)).toContain("commerce-suite");
    assert.plan.selectedPacks.map(x => x.id)).toContain("analytics-suite");
    assert.plan.actions.length).toBeGreaterThan(0);
  });

  await t.test("propagates approval requirements from selected actions", () => {
    const plan = planGrowthCapabilities({
      objective: "Harden website security",
      diagnosis: "Security vulnerabilities require remediation.",
      recommendation: "Run a security hardening plan.",
      signals: ["vulnerability_scan failed"]
    });
    assert.plan.selectedPacks.map(x => x.id)).toContain("security-suite");
    assert.plan.requiresApproval).equal(true);
  });
});
