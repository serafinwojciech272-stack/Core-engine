import test from "node:test";
import assert from "node:assert/strict";
import { clearSkillRegistryForTests, getSkill, registerSkill } from "@/lib/skills/registry";
import { evaluateSkillRiskGate } from "@/lib/skills/risk-gate";
import { forexTradingSkill } from "@/lib/skills/trading-forex";

test("M11 skill registry stores versioned capabilities", () => {
  clearSkillRegistryForTests();
  registerSkill(forexTradingSkill);
  const skill = getSkill("trading.forex");
  assert.equal(skill?.version, "1.0.0");
  assert.ok(skill?.capabilities.some(c => c.id === "trade.execute"));
});

test("M11 critical forex execution requires approval", () => {
  const result = evaluateSkillRiskGate({
    skill: forexTradingSkill,
    capabilityId: "trade.execute",
    mode: "LIVE",
    approved: false,
    killSwitchActive: false
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "EXPLICIT_APPROVAL_REQUIRED");
});

test("M11 kill switch always blocks execution", () => {
  const result = evaluateSkillRiskGate({
    skill: forexTradingSkill,
    capabilityId: "trade.execute",
    mode: "LIVE",
    approved: true,
    killSwitchActive: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "KILL_SWITCH_ACTIVE");
});
