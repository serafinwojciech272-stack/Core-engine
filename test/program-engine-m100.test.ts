import test from "node:test";
import assert from "node:assert/strict";
import { PROGRAM_STAGES, createProgram, validateProgram } from "../lib/program-engine";

test("program engine contains Universal Agent stages 113-124", () => {
  const ids = PROGRAM_STAGES.map(stage => stage.id);
  assert.deepEqual(ids.slice(-12), [113,114,115,116,117,118,119,120,121,122,123,124]);
});

test("program plan validates with the Universal Agent bridge", () => {
  const plan = createProgram("Universal Agent breakthrough", { maxStages: 50 });
  assert.equal(validateProgram(plan).valid, true);
  assert.equal(plan.stages.at(-1)?.id, 124);
});
