import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_LOOP, getAgentManifest, isAgentExecutionAllowed } from "@/lib/agent-contract";

test("personal agent keeps one governed loop", () => {
  assert.deepEqual([...AGENT_LOOP], ["OBSERVE","UNDERSTAND","PRIORITIZE","DECIDE","APPROVE","EXECUTE","MEASURE","LEARN"]);
});

test("execution is impossible without explicit approval", () => {
  assert.equal(isAgentExecutionAllowed("AWAITING_APPROVAL", "NOT_APPROVED"), false);
  assert.equal(isAgentExecutionAllowed("APPROVED", "NOT_APPROVED"), false);
  assert.equal(isAgentExecutionAllowed("APPROVED", "APPROVED"), true);
});

test("agent manifest remains human-approved and simulation-only by default", () => {
  const manifest = getAgentManifest();
  assert.equal(manifest.autonomy, "HUMAN_APPROVED");
  assert.equal(manifest.sideEffects, "SIMULATION_ONLY");
  assert.ok(manifest.capabilities.includes("capability-actions"));
});
