import test from "node:test";
import assert from "node:assert/strict";
import { canEnterGovernedMissionPhase } from "@/lib/skills/mission-state-gate";

test("measurement completion gate requires MEASURING", () => {
  assert.equal(canEnterGovernedMissionPhase("MEASURING", "MEASUREMENT"), true);
  assert.equal(canEnterGovernedMissionPhase("COMPLETED", "MEASUREMENT"), false);
  assert.equal(canEnterGovernedMissionPhase("EXECUTING", "MEASUREMENT"), false);
});

test("measurement completion cannot re-enter after completion", () => {
  assert.equal(canEnterGovernedMissionPhase("COMPLETED", "MEASUREMENT"), false);
  assert.equal(canEnterGovernedMissionPhase("LEARNED", "MEASUREMENT"), false);
});

test("learning remains blocked until completion", () => {
  assert.equal(canEnterGovernedMissionPhase("MEASURING", "LEARNING"), false);
  assert.equal(canEnterGovernedMissionPhase("COMPLETED", "LEARNING"), true);
});
