import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROGRAM_STAGES, createProgram, validateProgram } from "@/lib/program-engine";

describe("M176-M200 program bridge", () => {
  it("contains skill intelligence stages 176-200", () => {
    const ids = PROGRAM_STAGES.map(stage => stage.id);
    assert.deepEqual(ids.slice(-25), Array.from({ length: 25 }, (_, i) => 176 + i));
  });
  it("allows the expanded program scope to contain the complete roadmap", () => {
    const plan = createProgram("Universal Skill Intelligence");
    assert.equal(plan.scope.maxStages, 300);
    assert.equal(plan.stages.length >= 200, true);
    assert.equal(validateProgram(plan).valid, true);
  });
});