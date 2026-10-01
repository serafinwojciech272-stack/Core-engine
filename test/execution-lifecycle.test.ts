import test from "node:test";
import assert from "node:assert/strict";
import { runExecutionLifecycle } from "@/lib/skills/execution-lifecycle";
import { conservativeDefaultRiskLimits } from "@/lib/skills/risk-engine";
import { forexTradingSkill } from "@/lib/skills/trading-forex";

const context = {
  tenantId: "test",
  missionId: "m11",
  mode: "SIMULATION" as const,
  approvalRequired: false,
  correlationId: "m11-lifecycle-1",
};

test("M11 lifecycle is fail-closed and non-side-effecting without an executor", async () => {
  const result = await runExecutionLifecycle({
    skill: forexTradingSkill,
    capabilityId: "trade.propose",
    context,
    approved: true,
  });
  assert.equal(result.state, "EXECUTION_READY");
  assert.equal(result.execution.status, "NOT_EXECUTED");
  assert.equal(result.execution.sideEffect, false);
  assert.equal(result.memory, undefined);
  assert.equal(result.learning, undefined);
});

test("M11 high-risk lifecycle requires approval and does not execute", async () => {
  const result = await runExecutionLifecycle({
    skill: forexTradingSkill,
    capabilityId: "trade.validate",
    context,
    approved: false,
  });
  assert.equal(result.state, "REJECTED");
  assert.equal(result.approval.required, true);
  assert.equal(result.execution.status, "NOT_EXECUTED");
  assert.equal(result.execution.sideEffect, false);
});

test("M11 verified execution creates memory and learning events", async () => {
  const result = await runExecutionLifecycle({
    skill: forexTradingSkill,
    capabilityId: "trade.propose",
    context: { ...context, correlationId: "m11-lifecycle-2" },
    approved: true,
    evidenceIds: ["e-plan"],
    execute: () => ({
      executionId: "exec-1",
      correlationId: "m11-lifecycle-2",
      status: "EXECUTED",
      sideEffect: false,
      evidenceIds: ["e-exec"],
    }),
    verify: (execution) => ({
      verificationId: "verify-1",
      correlationId: execution.correlationId,
      passed: true,
      checks: ["shape", "policy"],
      evidenceIds: ["e-verify"],
    }),
    riskSnapshot: {
      equity: 10000,
      dailyLossPct: 0,
      openPositions: 0,
      grossExposurePct: 0,
      spreadPoints: 1,
      estimatedSlippagePoints: 1,
      killSwitchActive: false,
    },
    riskLimits: conservativeDefaultRiskLimits,
  });
  assert.equal(result.state, "LEARNED");
  assert.equal(result.auditTrail.at(-1), "LEARNED");
  assert.deepEqual(result.memory?.evidenceIds, ["e-plan", "e-exec", "e-verify"]);
  assert.equal(result.learning?.eligible, true);
});

test("M11 failed verification cannot reach memory or learning", async () => {
  const result = await runExecutionLifecycle({
    skill: forexTradingSkill,
    capabilityId: "trade.propose",
    context: { ...context, correlationId: "m11-lifecycle-3" },
    approved: true,
    execute: () => ({
      executionId: "exec-2",
      correlationId: "m11-lifecycle-3",
      status: "EXECUTED",
      sideEffect: false,
      evidenceIds: [],
    }),
    verify: (execution) => ({
      verificationId: "verify-2",
      correlationId: execution.correlationId,
      passed: false,
      checks: ["failed-check"],
      evidenceIds: ["e-fail"],
    }),
  });
  assert.equal(result.state, "EXECUTED");
  assert.equal(result.memory, undefined);
  assert.equal(result.learning, undefined);
});


test("M11 approval cannot be anonymous when explicit approval is required", async () => {
  const result = await runExecutionLifecycle({
    skill: forexTradingSkill,
    capabilityId: "trade.validate",
    context: { ...context, correlationId: "m11-lifecycle-approval-identity" },
    approved: true,
  });
  assert.equal(result.state, "REJECTED");
  assert.equal(result.execution.status, "NOT_EXECUTED");
  assert.equal(result.execution.sideEffect, false);
});

test("M11 rejects executor results with a mismatched correlation id", async () => {
  const result = await runExecutionLifecycle({
    skill: forexTradingSkill,
    capabilityId: "trade.propose",
    context: { ...context, correlationId: "m11-lifecycle-correlation" },
    approved: true,
    execute: () => ({
      executionId: "exec-mismatch",
      correlationId: "attacker-or-stale-correlation",
      status: "EXECUTED",
      sideEffect: true,
      evidenceIds: [],
    }),
  });
  assert.equal(result.state, "REJECTED");
  assert.equal(result.execution.status, "FAILED");
  assert.equal(result.execution.sideEffect, false);
  assert.equal(result.memory, undefined);
  assert.equal(result.learning, undefined);
});

test("M11 rejects verification results with a mismatched correlation id", async () => {
  const result = await runExecutionLifecycle({
    skill: forexTradingSkill,
    capabilityId: "trade.propose",
    context: { ...context, correlationId: "m11-lifecycle-verification-correlation" },
    approved: true,
    execute: () => ({
      executionId: "exec-verify-mismatch",
      correlationId: "m11-lifecycle-verification-correlation",
      status: "EXECUTED",
      sideEffect: false,
      evidenceIds: [],
    }),
    verify: () => ({
      verificationId: "verify-mismatch",
      correlationId: "attacker-or-stale-correlation",
      passed: true,
      checks: ["fake-pass"],
      evidenceIds: [],
    }),
  });
  assert.equal(result.state, "REJECTED");
  assert.equal(result.verification?.passed, false);
  assert.equal(result.memory, undefined);
  assert.equal(result.learning, undefined);
});
