import test from "node:test";
import assert from "node:assert/strict";
import { buildUniversalAgentPlan } from "../lib/universal-agent.ts";
import {
  createUniversalAgentRun, transitionUniversalAgentRun, approveUniversalAgentRun,
  replanUniversalAgentRun, validateUniversalAgentRun, canTransitionUniversalAgentRun
} from "../lib/universal-agent-os.ts";

const plan = () => buildUniversalAgentPlan({ objective:"Improve operations safely", domain:"operations" });

test("M125 creates governed OS run and preserves approval boundary", () => {
  const run = createUniversalAgentRun(plan());
  assert.equal(run.state, "RECEIVED");
  assert.equal(run.plan.policy.executionAllowed, false);
  assert.equal(validateUniversalAgentRun(run).valid, true);
  assert.equal(canTransitionUniversalAgentRun("RECEIVED","UNDERSTANDING"), true);
  assert.equal(canTransitionUniversalAgentRun("RECEIVED","EXECUTING"), false);
});

test("M125 supports deterministic governed lifecycle", () => {
  let run = createUniversalAgentRun(plan());
  run = transitionUniversalAgentRun(run,"UNDERSTANDING","UNDERSTAND");
  run = transitionUniversalAgentRun(run,"PLANNING","PLAN");
  run = transitionUniversalAgentRun(run,"AWAITING_APPROVAL","POLICY_GATE");
  run = approveUniversalAgentRun(run);
  run = transitionUniversalAgentRun(run,"VERIFYING","EXECUTE_DONE",["execution_event"]);
  run = transitionUniversalAgentRun(run,"MEASURING","VERIFIED",["verification"]);
  run = replanUniversalAgentRun(run,"new evidence requires another plan");
  assert.equal(run.state,"REPLANNING");
  assert.equal(run.cycle,1);
  assert.equal(run.events.length,7);
  assert.equal(validateUniversalAgentRun(run).valid,true);
});

test("M125 rejects illegal transition and tampered integrity", () => {
  const run = createUniversalAgentRun(plan());
  assert.throws(() => transitionUniversalAgentRun(run,"EXECUTING","BYPASS"));
  const tampered = { ...run, objective:"tampered" };
  assert.equal(validateUniversalAgentRun(tampered).valid,false);
});
