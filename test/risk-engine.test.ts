import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRisk, conservativeDefaultRiskLimits } from "@/lib/skills/risk-engine";

test("M11 risk engine fails closed on kill switch", () => {
  const result = evaluateRisk(
    {
      equity: 10000,
      dailyLossPct: 0,
      openPositions: 0,
      grossExposurePct: 0,
      spreadPoints: 1,
      estimatedSlippagePoints: 1,
      killSwitchActive: true,
    },
    conservativeDefaultRiskLimits,
  );
  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons, ["KILL_SWITCH_ACTIVE"]);
});

test("M11 risk engine blocks cumulative risk limits", () => {
  const result = evaluateRisk(
    {
      equity: 10000,
      dailyLossPct: 2,
      openPositions: 3,
      grossExposurePct: 10,
      spreadPoints: 31,
      estimatedSlippagePoints: 11,
      killSwitchActive: false,
    },
    conservativeDefaultRiskLimits,
  );
  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons, [
    "DAILY_LOSS_LIMIT",
    "MAX_OPEN_POSITIONS",
    "MAX_GROSS_EXPOSURE",
    "MAX_SPREAD",
    "MAX_SLIPPAGE",
  ]);
});
