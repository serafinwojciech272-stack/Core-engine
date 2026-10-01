import test from "node:test";
import assert from "node:assert/strict";
import { syncExecutionToCoreEngine } from "@/lib/skills/core-engine-bridge";
import { forexTradingSkill } from "@/lib/skills/trading-forex";
import { runExecutionLifecycle } from "@/lib/skills/execution-lifecycle";

async function lifecycle() {
  return runExecutionLifecycle({
    skill: forexTradingSkill,
    capabilityId: "trade.propose",
    context: {
      tenantId: "test",
      missionId: "m11",
      mode: "SIMULATION",
      approvalRequired: false,
      correlationId: "bridge-test"
    },
    approved: true,
    execute: () => ({
      executionId: "exec-bridge",
      correlationId: "bridge-test",
      status: "EXECUTED",
      sideEffect: false,
      evidenceIds: ["e-exec"]
    }),
    verify: execution => ({
      verificationId: "verify-bridge",
      correlationId: execution.correlationId,
      passed: true,
      checks: ["verified"],
      evidenceIds: ["e-verify"]
    })
  });
}

test("M11 bridge never persists an unverified lifecycle", async () => {
  const result = await syncExecutionToCoreEngine({
    tenantId: "test",
    missionId: "missing",
    lifecycle: await runExecutionLifecycle({
      skill: forexTradingSkill,
      capabilityId: "trade.propose",
      context: {
        tenantId: "test",
        missionId: "missing",
        mode: "SIMULATION",
        approvalRequired: false,
        correlationId: "bridge-blocked"
      },
      approved: true
    })
  });
  assert.equal(result.persisted, false);
  assert.equal(result.reason, "CORE_SYNC_REQUIRES_VERIFIED_LIFECYCLE");
});

test("M11 bridge accepts only the governed verified lifecycle", async () => {
  const result = await lifecycle();
  assert.equal(result.state, "LEARNED");
  assert.equal(result.verification?.passed, true);
  assert.equal(result.learning?.eligible, true);
  assert.equal(result.execution.sideEffect, false);
});
