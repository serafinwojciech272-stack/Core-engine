import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyCapabilityReceipt,
  executeCapabilityAction,
  getCapabilityAction,
  getStoredCapabilityExecution,
  redactSecrets,
  type CapabilityExecutionReceipt
} from "@/lib/capability-action-registry";
import {
  isObservationalAdapter,
  listCapabilityAdapters,
  registerCapabilityAdapter,
  resolveCapabilityAdapter,
  unregisterCapabilityAdapter,
  type CapabilityAdapter
} from "@/lib/capability-adapters";
import { missions, transitionMission, type Mission } from "@/lib/engine";

const SIMULATION_ID = "core.simulation.v1";

// Deterministic failing adapters, each bound to a distinct capability action so
// adapter resolution is unambiguous. Specialised adapters win over the
// simulation fallback, so these reliably drive the failure paths.
function registerAdapter(adapter: CapabilityAdapter) {
  if (!listCapabilityAdapters().includes(adapter.id)) registerCapabilityAdapter(adapter);
}

registerAdapter({
  id: "test.transient.v1",
  supports: (action) => action.id === "seo.optimize",
  async execute() {
    const startedAt = new Date().toISOString();
    return { status: "FAILED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: "Transient adapter fault.", errorCategory: "EXECUTION_FAILED", retryable: true };
  }
});

registerAdapter({
  id: "test.hard-fail.v1",
  supports: (action) => action.id === "email.audit",
  async execute() {
    const startedAt = new Date().toISOString();
    return { status: "FAILED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: "Permanent adapter fault.", errorCategory: "EXECUTION_FAILED", retryable: false };
  }
});

registerAdapter({
  id: "test.timeout.v1",
  supports: (action) => action.id === "commerce.optimize-checkout",
  async execute() {
    // Never resolves within the (tiny) timeout budget.
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { status: "EXECUTED", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), sideEffect: true, message: "late" };
  }
});

// analytics.audit has no specialised adapter, so it resolves to the simulation
// fallback and executes deterministically without network access.
const FALLBACK_ACTION = "analytics.audit";

test("successful execution returns EXECUTED with a complete receipt", async () => {
  const receipt = await executeCapabilityAction({ actionId: FALLBACK_ACTION, approved: true, missionId: "m-success", idempotencyKey: "ok-1" });
  assert.equal(receipt.status, "EXECUTED");
  assert.equal(receipt.capabilityActionId, FALLBACK_ACTION);
  assert.equal(receipt.actionId, FALLBACK_ACTION);
  assert.equal(receipt.missionId, "m-success");
  assert.equal(receipt.adapterId, SIMULATION_ID);
  assert.equal(receipt.attempt, 1);
  assert.equal(receipt.sideEffect, false);
  assert.equal(receipt.sideEffectStatus, "NONE");
  assert.equal(receipt.retryable, false);
  assert.equal(receipt.observationalOnly, true);
  assert.equal(receipt.executionMode, "ADAPTER");
  assert.ok(receipt.executionId.startsWith("exec-"));
  assert.ok(Date.parse(receipt.startedAt) <= Date.parse(receipt.completedAt));
  assert.equal(receipt.error, undefined);
});

test("adapter not found produces a deterministic non-retryable result", async () => {
  assert.equal(unregisterCapabilityAdapter(SIMULATION_ID), true);
  try {
    const receipt = await executeCapabilityAction({ actionId: FALLBACK_ACTION, approved: true, missionId: "m-noadapter", idempotencyKey: "no-1" });
    assert.equal(receipt.status, "ADAPTER_NOT_FOUND");
    assert.equal(receipt.error?.category, "ADAPTER_NOT_FOUND");
    assert.equal(receipt.retryable, false);
    assert.equal(receipt.sideEffect, false);
    assert.equal(receipt.sideEffectStatus, "NONE");
    assert.equal(classifyCapabilityReceipt(receipt).httpStatus, 501);
  } finally {
    registerCapabilityAdapter({
      id: SIMULATION_ID,
      observationalOnly: true,
      supports: () => true,
      async execute(action) {
        const startedAt = new Date().toISOString();
        return { status: "EXECUTED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: `Adapter accepted ${action.id}.`, output: { adapterId: SIMULATION_ID, actionId: action.id } };
      }
    });
  }
});

test("unknown capability action is reported as NOT_FOUND, not executed", async () => {
  const receipt = await executeCapabilityAction({ actionId: "does.not.exist", approved: true });
  assert.equal(receipt.status, "NOT_FOUND");
  assert.equal(receipt.retryable, false);
  assert.equal(receipt.sideEffect, false);
});

test("approval required blocks execution before the adapter runs", async () => {
  const receipt = await executeCapabilityAction({ actionId: "security.harden", approved: false, missionId: "m-approval", idempotencyKey: "appr-1" });
  assert.equal(receipt.status, "APPROVAL_REQUIRED");
  assert.equal(receipt.error?.category, "APPROVAL_REQUIRED");
  assert.equal(receipt.retryable, false);
  assert.equal(receipt.sideEffect, false);
  assert.equal(classifyCapabilityReceipt(receipt).httpStatus, 403);
  // No execution record is created for a blocked approval.
  assert.equal(getStoredCapabilityExecution("m-approval", "appr-1"), null);
});

test("adapter execution failure is observable and persists a failure receipt", async () => {
  const receipt = await executeCapabilityAction({ actionId: "seo.optimize", approved: true, missionId: "m-fail", idempotencyKey: "fail-1" });
  assert.equal(receipt.status, "RETRYABLE");
  assert.equal(receipt.retryable, true);
  assert.equal(receipt.error?.category, "EXECUTION_FAILED");
  assert.equal(receipt.sideEffectStatus, "NONE");
  const stored = getStoredCapabilityExecution("m-fail", "fail-1");
  assert.equal(stored?.status, "RETRYABLE");
  assert.equal(stored?.executionId, receipt.executionId);
});

test("retryable failure can be retried and increments the attempt", async () => {
  const first = await executeCapabilityAction({ actionId: "seo.optimize", approved: true, missionId: "m-retry", idempotencyKey: "retry-1" });
  assert.equal(first.status, "RETRYABLE");
  assert.equal(first.attempt, 1);

  const second = await executeCapabilityAction({ actionId: "seo.optimize", approved: true, missionId: "m-retry", idempotencyKey: "retry-1" });
  assert.equal(second.status, "RETRYABLE");
  assert.equal(second.attempt, 2);
  assert.equal(second.executionId, first.executionId);
});

test("non-retryable failure is FAILED and blocks automatic retry", async () => {
  const first = await executeCapabilityAction({ actionId: "email.audit", approved: true, missionId: "m-hard", idempotencyKey: "hard-1" });
  assert.equal(first.status, "FAILED");
  assert.equal(first.retryable, false);

  const retry = await executeCapabilityAction({ actionId: "email.audit", approved: true, missionId: "m-hard", idempotencyKey: "hard-1" });
  assert.equal(retry.status, "BLOCKED");
  assert.equal(retry.retryable, false);
  assert.equal(retry.error?.category, "EXECUTION_BLOCKED");
  assert.equal(classifyCapabilityReceipt(retry).retryBlocked, true);
});

test("timeout on a side-effecting adapter is blocked rather than auto-retried", async () => {
  const receipt = await executeCapabilityAction({ actionId: "commerce.optimize-checkout", approved: true, missionId: "m-timeout", idempotencyKey: "timeout-1", timeoutMs: 20 });
  assert.equal(receipt.status, "BLOCKED");
  assert.equal(receipt.retryable, false);
  assert.equal(receipt.error?.category, "EXECUTION_TIMEOUT");
  assert.equal(receipt.sideEffectStatus, "UNKNOWN");
});

test("duplicate execution of a successful action is idempotent with no new side effect", async () => {
  const first = await executeCapabilityAction({ actionId: FALLBACK_ACTION, approved: true, missionId: "m-dup", idempotencyKey: "dup-1" });
  assert.equal(first.status, "EXECUTED");
  const second = await executeCapabilityAction({ actionId: FALLBACK_ACTION, approved: true, missionId: "m-dup", idempotencyKey: "dup-1" });
  assert.equal(second.status, "EXECUTED");
  assert.equal(second.duplicate, true);
  assert.equal(second.sideEffect, false);
  assert.equal(second.sideEffectStatus, "NONE");
  assert.equal(second.executionId, first.executionId);
});

test("idempotency key cannot be reused for a different action", async () => {
  await executeCapabilityAction({ actionId: FALLBACK_ACTION, approved: true, missionId: "m-conflict", idempotencyKey: "shared" });
  const conflict = await executeCapabilityAction({ actionId: "i18n.audit", approved: true, missionId: "m-conflict", idempotencyKey: "shared" });
  assert.equal(conflict.status, "IDEMPOTENCY_CONFLICT");
  assert.equal(conflict.error?.category, "IDEMPOTENCY_CONFLICT");
  assert.equal(conflict.retryable, false);
  assert.equal(classifyCapabilityReceipt(conflict).httpStatus, 409);
});

test("failure receipt preserves the required execution fields", async () => {
  const receipt: CapabilityExecutionReceipt = await executeCapabilityAction({ actionId: "seo.optimize", approved: true, missionId: "m-fields", idempotencyKey: "fields-1" });
  for (const field of ["missionId", "capabilityActionId", "adapterId", "executionId", "attempt", "status", "startedAt", "completedAt", "sideEffect", "retryable"] as const) {
    assert.ok(receipt[field] !== undefined, `missing ${field}`);
  }
  assert.equal(typeof receipt.attempt, "number");
  assert.ok(receipt.error);
  assert.equal(typeof receipt.error?.category, "string");
  assert.equal(typeof receipt.error?.message, "string");
});

test("observational-only adapters never report a side effect", async () => {
  const adapter = resolveCapabilityAdapter(getCapabilityAction(FALLBACK_ACTION)!)!;
  assert.equal(isObservationalAdapter(adapter), true);
  const receipt = await executeCapabilityAction({ actionId: FALLBACK_ACTION, approved: true, missionId: "m-obs", idempotencyKey: "obs-1" });
  assert.equal(receipt.observationalOnly, true);
  assert.equal(receipt.sideEffect, false);
  assert.equal(receipt.sideEffectStatus, "NONE");
});

test("a deterministic adapter input error is FAILED and not auto-retryable", async () => {
  const receipt = await executeCapabilityAction({ actionId: "seo.audit", approved: true, missionId: "m-denied", idempotencyKey: "denied-1", input: { url: "http://127.0.0.1:8080" } });
  assert.equal(receipt.status, "FAILED");
  assert.equal(receipt.retryable, false);
  assert.equal(receipt.sideEffect, false);
  assert.match(receipt.message, /PRIVATE_URL_BLOCKED/);
});

function mission(state: Mission["state"]): Mission {
  return { id: "m-lifecycle", decisionId: "d-1", objective: "grow", state, kpi: "conversion_rate", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), executionCount: 0 };
}

test("existing mission state machine still governs transitions", () => {
  assert.equal(missions instanceof Map, true);
  const executing = transitionMission(mission("APPROVED"), "EXECUTING");
  assert.equal(executing.state, "EXECUTING");
  const failed = transitionMission(executing, "FAILED");
  assert.equal(failed.state, "FAILED");
  // A terminal state cannot jump directly back to measurement.
  assert.throws(() => transitionMission(failed, "MEASURING"), /INVALID_TRANSITION/);
});

test("credentials embedded in adapter errors are redacted from receipts", async () => {
  registerAdapter({
    id: "test.secret-leak.v1",
    supports: (action) => action.id === "monitor.audit",
    async execute() {
      throw new Error("upstream rejected Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop and key sk-abcdefghijklmnopqrstuvwx at https://api.example.com/v1?api_key=supersecretvalue");
    }
  });

  const receipt = await executeCapabilityAction({ actionId: "monitor.audit", approved: true, missionId: "m-secret", idempotencyKey: "secret-1" });
  assert.equal(receipt.status, "RETRYABLE");
  assert.ok(receipt.error);
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes("supersecretvalue"), false);
  assert.equal(serialized.includes("sk-abcdefghijklmnopqrstuvwx"), false);
  assert.equal(serialized.includes("eyJhbGciOiJIUzI1NiJ9"), false);
  assert.equal(receipt.error?.message.includes("<redacted>"), true);
});

test("secret redaction covers bearer, query and provider key shapes", () => {
  assert.equal(redactSecrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz"), "Authorization: Bearer <redacted>");
  assert.equal(redactSecrets("https://x.test/p?token=deadbeefcafebabe"), "https://x.test/p?token=<redacted>");
  assert.equal(redactSecrets("sk-1234567890abcdefghij"), "<redacted>");
});

test("classification is total over every execution status", () => {
  for (const status of ["EXECUTED", "NOT_FOUND", "APPROVAL_REQUIRED", "ADAPTER_NOT_FOUND", "IDEMPOTENCY_CONFLICT", "BLOCKED", "RETRYABLE", "FAILED"] as const) {
    const outcome = classifyCapabilityReceipt({ status } as never);
    assert.equal(typeof outcome.httpStatus, "number");
    assert.equal(outcome.ok, status === "EXECUTED");
    assert.equal(typeof outcome.attempted, "boolean");
  }
});
