import test from "node:test";
import assert from "node:assert/strict";
import { assertGovernedMissionPhase, canEnterGovernedMissionPhase, requiredMissionStateForPhase } from "@/lib/skills/mission-state-gate";

test("execution phase requires APPROVED", () => {
  assert.equal(canEnterGovernedMissionPhase("APPROVED", "EXECUTION"), true);
  assert.equal(canEnterGovernedMissionPhase("EXECUTING", "EXECUTION"), false);
  assert.equal(requiredMissionStateForPhase("EXECUTION"), "APPROVED");
  assert.doesNotThrow(() => assertGovernedMissionPhase("APPROVED", "EXECUTION"));
  assert.throws(() => assertGovernedMissionPhase("COMPLETED", "EXECUTION"));
});

test("measurement phase requires EXECUTING", () => {
  assert.equal(canEnterGovernedMissionPhase("EXECUTING", "MEASUREMENT"), true);
  assert.equal(canEnterGovernedMissionPhase("APPROVED", "MEASUREMENT"), false);
  assert.doesNotThrow(() => assertGovernedMissionPhase("EXECUTING", "MEASUREMENT"));
});

test("learning phase requires COMPLETED", () => {
  assert.equal(canEnterGovernedMissionPhase("COMPLETED", "LEARNING"), true);
  assert.equal(canEnterGovernedMissionPhase("MEASURING", "LEARNING"), false);
  assert.equal(canEnterGovernedMissionPhase("LEARNED", "LEARNING"), false);
  assert.doesNotThrow(() => assertGovernedMissionPhase("COMPLETED", "LEARNING"));
});
