import test from "node:test";
import assert from "node:assert/strict";
import { createWebBuildPlan, webBuildStages } from "@/lib/skills/web-builder-orchestrator";

test("M11 web builder contains full governed lifecycle", () => {
  const plan = createWebBuildPlan("demo-site", ["nextjs", "typescript", "supabase"]);
  assert.deepEqual(plan.stages, webBuildStages);
  assert.equal(plan.requiresHumanApproval, true);
  assert.equal(new Set(plan.stack).size, 3);
});
