import test from "node:test";
import assert from "node:assert/strict";
import { createAppBuildPlan, appBuildStages } from "@/lib/skills/app-builder-orchestrator";
import { createAgentBuildPlan, agentBuildStages } from "@/lib/skills/agent-builder-orchestrator";

test("M11 app builder is a governed end-to-end lifecycle", () => {
  const plan = createAppBuildPlan("crm", ["nextjs", "typescript", "supabase", "typescript"]);
  assert.deepEqual(plan.stages, appBuildStages);
  assert.equal(plan.requiresHumanApproval, true);
  assert.deepEqual(plan.stack, ["nextjs", "typescript", "supabase"]);
});

test("M11 agent builder composes capabilities and tools deterministically", () => {
  const plan = createAgentBuildPlan("research-agent", ["research", "research"], ["browser", "github"]);
  assert.deepEqual(plan.stages, agentBuildStages);
  assert.deepEqual(plan.capabilities, ["research"]);
  assert.deepEqual(plan.tools, ["browser", "github"]);
  assert.equal(plan.requiresHumanApproval, true);
});
