import { describe, expect, it } from "vitest";
import { planGrowthCapabilities } from "@/lib/capability-planner";

describe("growth capability planner", () => {
  it("builds a conversion growth plan from business signals", () => {
    const plan = planGrowthCapabilities({
      objective: "Increase qualified checkout completion",
      diagnosis: "Checkout dropoff is high while traffic is growing.",
      recommendation: "Optimize checkout and conversion tracking.",
      signals: ["checkout_dropoff 41%", "traffic +18%", "conversion_rate 2.8%"]
    });
    expect(plan.selectedPacks.length).toBeGreaterThan(0);
    expect(plan.selectedPacks.map(x => x.id)).toContain("commerce-suite");
    expect(plan.selectedPacks.map(x => x.id)).toContain("analytics-suite");
    expect(plan.actions.length).toBeGreaterThan(0);
  });

  it("propagates approval requirements from selected actions", () => {
    const plan = planGrowthCapabilities({
      objective: "Harden website security",
      diagnosis: "Security vulnerabilities require remediation.",
      recommendation: "Run a security hardening plan.",
      signals: ["vulnerability_scan failed"]
    });
    expect(plan.selectedPacks.map(x => x.id)).toContain("security-suite");
    expect(plan.requiresApproval).toBe(true);
  });
});
