import test from "node:test";
import assert from "node:assert/strict";
import { evaluateExecutionRequest, executionPlaneStages } from "@/lib/skills/execution-plane";
import { forexTradingSkill } from "@/lib/skills/trading-forex";
import { conservativeDefaultRiskLimits } from "@/lib/skills/risk-engine";

const context = {
  tenantId: "test",
  missionId: "m11",
  mode: "SIMULATION" as const,
  approvalRequired: false,
  correlationId: "corr-1",
};

test("M11 execution plane has one governed lifecycle", () => {
  assert.equal(executionPlaneStages.length, 12);
  assert.equal(executionPlaneStages[0], "CORE");
  assert.equal(executionPlaneStages.at(-1), "LEARNING");
});

test("M11 execution plane blocks missing approval before executor", () => {
  const result = evaluateExecutionRequest({
    skill: forexTradingSkill,
    capabilityId: "trade.validate",
    context,
    approved: false,
    killSwitchActive: false,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.stage, "APPROVAL");
});

test("M11 execution plane fails closed on kill switch", () => {
  const result = evaluateExecutionRequest({
    skill: forexTradingSkill,
    capabilityId: "trade.propose",
    context,
    approved: true,
    killSwitchActive: true,
    riskSnapshot: {
      equity: 10000,
      dailyLossPct: 0,
      openPositions: 0,
      grossExposurePct: 0,
      spreadPoints: 1,
      estimatedSlippagePoints: 1,
      killSwitchActive: true,
    },
    riskLimits: conservativeDefaultRiskLimits,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.stage, "POLICY");
});
