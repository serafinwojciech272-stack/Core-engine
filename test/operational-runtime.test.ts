import test from "node:test";
import assert from "node:assert/strict";
import { executeOperationalRun } from "@/lib/operational-runtime";

test("operational runtime completes a website task through the full lifecycle", async () => {
  const run = await executeOperationalRun("Zbuduj stronę WWW dla studia AI");
  assert.equal(run.status, "COMPLETED");
  assert.deepEqual(run.stages.map(s => s.id), ["PLAN","TOOL_CALL","EXECUTE","VERIFY","ARTIFACT","OUTCOME"]);
  assert.equal(run.stages.every(s => s.status === "SUCCEEDED"), true);
  assert.equal(run.tool?.id, "multitask.website.build");
  assert.equal(run.tool?.status, "EXECUTED");
  assert.equal(run.artifact?.status, "EXECUTED");
  assert.equal(run.verification.passed, true);
  assert.equal(run.outcome.status, "READY");
});

test("operational runtime preserves no-tool path without false execution", async () => {
  const run = await executeOperationalRun("Wyjaśnij zasadę Pareto");
  assert.equal(run.status, "NO_TOOL");
  assert.equal(run.tool, undefined);
  assert.equal(run.artifact, undefined);
  assert.equal(run.outcome.status, "NO_TOOL");
  assert.equal(run.stages[1].detail?.includes("No deterministic capability tool required"), true);
});
