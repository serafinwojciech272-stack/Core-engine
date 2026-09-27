import test from "node:test";
import assert from "node:assert/strict";
import { getAgentManifest, agentStageForMissionState, isAgentExecutionAllowed } from "@/lib/agent-contract";

test("exposes a truthful commercial agent contract", () => {
  const manifest = getAgentManifest();

  assert.equal(manifest.id, "core-business-agent");
  assert.equal(manifest.contract, "agent-runtime-v1");
  assert.equal(manifest.autonomy, "HUMAN_APPROVED");
  assert.equal(manifest.sideEffects, "SIMULATION_ONLY");
  assert.equal(manifest.durableState, "SUPABASE_REQUIRED_FOR_PRODUCTION");
  assert.deepEqual(manifest.loop, [
    "OBSERVE",
    "UNDERSTAND",
    "PRIORITIZE",
    "DECIDE",
    "APPROVE",
    "EXECUTE",
    "MEASURE",
    "LEARN"
  ]);
});

test("maps mission states to the single agent loop", () => {
  assert.equal(agentStageForMissionState("AWAITING_APPROVAL"), "APPROVE");
  assert.equal(agentStageForMissionState("APPROVED"), "EXECUTE");
  assert.equal(agentStageForMissionState("MEASURING"), "MEASURE");
  assert.equal(agentStageForMissionState("LEARNED"), "LEARN");
});

test("execution requires both the approved mission state and authorization", () => {
  assert.equal(isAgentExecutionAllowed("APPROVED", "APPROVED"), true);
  assert.equal(isAgentExecutionAllowed("AWAITING_APPROVAL", "APPROVED"), false);
  assert.equal(isAgentExecutionAllowed("APPROVED", "NOT_APPROVED"), false);
});
