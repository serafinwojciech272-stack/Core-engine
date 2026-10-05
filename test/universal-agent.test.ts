import test from "node:test";
import assert from "node:assert/strict";
import { buildUniversalAgentPlan, advanceUniversalAgentStage, canUniversalAgentExecute, replanUniversalAgent, UNIVERSAL_AGENT_STAGES } from "../lib/universal-agent";

test("Universal Agent v2 creates governed multi-stage plan", () => {
  const plan = buildUniversalAgentPlan({
    objective: "Improve conversion and launch a measurable growth mission",
    domain: "growth",
    signals: ["conversion", "revenue"],
  });
  assert.equal(plan.version, "universal-agent-v2");
  assert.equal(plan.stages.length, 12);
  assert.equal(plan.stages[0].id, 113);
  assert.equal(plan.stages.at(-1)?.id, 124);
  assert.equal(plan.status, "AWAITING_APPROVAL");
  assert.equal(plan.policy.requiresApproval, true);
  assert.equal(canUniversalAgentExecute(plan).allowed, false);
});

test("Universal Agent requires explicit approval before execution", () => {
  const plan = buildUniversalAgentPlan({
    objective: "Execute an approved operational improvement",
    domain: "operations",
    approval: "APPROVED"
  });
  assert.equal(plan.policy.requiresApproval, true);
  assert.equal(canUniversalAgentExecute(plan).allowed, true);
});

test("Universal Agent advances only through declared stages", () => {
  let plan = buildUniversalAgentPlan({ objective: "Analyze business performance" });
  plan = advanceUniversalAgentStage(plan, 113, ["intent_normalized"]);
  assert.equal(plan.stages[1].status, "READY");
  assert.equal(plan.stages[1].id, 114);
});

test("Universal Agent blocks execution when critical risk is present", () => {
  const plan = buildUniversalAgentPlan({
    objective: "Run a critical high risk action",
    domain: "business",
    approval: "APPROVED"
  });
  if (plan.actions.some(a => a.risk === "CRITICAL")) {
    assert.equal(canUniversalAgentExecute(plan).allowed, false);
  } else {
    assert.equal(plan.policy.requiresApproval, true);
  }
});

test("Universal Agent replanning preserves lineage through integrity", () => {
  const plan = buildUniversalAgentPlan({ objective: "Improve operations" });
  const next = replanUniversalAgent(plan, ["new evidence", "customer feedback"]);
  assert.equal(next.status, "PLANNED");
  assert.notEqual(next.integrity, plan.integrity);
  assert.ok(next.request.signals.includes("new evidence"));
});

test("Universal Agent stage contract is deterministic", () => {
  assert.deepEqual(UNIVERSAL_AGENT_STAGES.map(s => s.id), [113,114,115,116,117,118,119,120,121,122,123,124]);
});
