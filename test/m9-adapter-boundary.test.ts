import test from "node:test";
import assert from "node:assert/strict";
import { executeCapabilityAction, getCapabilityAction } from "@/lib/capability-action-registry";
import {
  adapterCredentialStatus,
  adapterHealth,
  describeAdapterBoundary,
  registerAdapterBoundary,
  resolveAdapterBoundary,
  resolveAdapterPolicy,
  withinRetryBudget,
} from "@/lib/capability-adapter-boundary";
import {
  capabilityAdapterList,
  registerCapabilityAdapter,
  unregisterCapabilityAdapter,
  type CapabilityAdapter,
} from "@/lib/capability-adapters";

const WEBHOOK_ACTION = "integration.webhook.dispatch";
const SIMULATION_ID = "core.simulation.v1";

function withEnv(name: string, value: string | undefined, run: () => void) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

test("M9 the adapter registry exposes a boundary descriptor per adapter", () => {
  const adapters = capabilityAdapterList();
  assert.ok(adapters.length >= 3);
  const descriptor = describeAdapterBoundary(adapters[0]);
  assert.equal(typeof descriptor.adapterId, "string");
  assert.equal(typeof descriptor.observationalOnly, "boolean");
  assert.ok(["READY", "DEGRADED", "UNCONFIGURED"].includes(descriptor.health));
  assert.ok(typeof descriptor.policy.timeoutMs === "number");
  assert.ok(typeof descriptor.policy.maxAttempts === "number");
});

test("M9 the webhook boundary requires an allowlist credential and never exposes its value", () => {
  withEnv("CORE_ENGINE_WEBHOOK_ALLOWLIST", undefined, () => {
    const status = adapterCredentialStatus("core.webhook.v1");
    const allowlist = status.find((item) => item.key === "webhook-allowlist");
    assert.equal(allowlist?.required, true);
    assert.equal(allowlist?.configured, false);
  });

  withEnv("CORE_ENGINE_WEBHOOK_ALLOWLIST", "https://hooks.example.com/", () => {
    const status = adapterCredentialStatus("core.webhook.v1");
    const allowlist = status.find((item) => item.key === "webhook-allowlist");
    assert.equal(allowlist?.configured, true);
    // The credential value itself must never appear in the descriptor.
    assert.equal(JSON.stringify(status).includes("hooks.example.com"), false);
  });
});

test("M9 an unconfigured credential boundary refuses execution before any external call", async () => {
  withEnv("CORE_ENGINE_WEBHOOK_ALLOWLIST", undefined, async () => {
    const resolution = resolveAdapterBoundary(getCapabilityAction(WEBHOOK_ACTION)!);
    assert.equal(resolution.ok, false);
    if (!resolution.ok) assert.equal(resolution.reason, "ADAPTER_UNCONFIGURED");

    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { called = true; return new Response("{}", { status: 200 }); };
    try {
      const receipt = await executeCapabilityAction({
        actionId: WEBHOOK_ACTION,
        approved: true,
        missionId: "m9-unconfigured",
        idempotencyKey: "m9-unconfigured-1",
        input: { url: "https://hooks.example.com/x", payload: { ok: true } },
      });
      assert.equal(receipt.status, "FAILED");
      assert.equal(receipt.retryable, false);
      assert.equal(receipt.sideEffect, false);
      assert.equal(receipt.adapterId, "core.webhook.v1");
      assert.equal(called, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("M9 mutating adapters are not auto-retryable and read-only adapters are", () => {
  assert.equal(resolveAdapterPolicy("core.webhook.v1").permission, "MUTATE");
  assert.equal(resolveAdapterPolicy("core.webhook.v1").retryable, false);
  assert.equal(resolveAdapterPolicy("core.web-audit.v1").permission, "OBSERVE");
  assert.equal(resolveAdapterPolicy("core.web-audit.v1").retryable, true);
});

test("M9 retry budget is bounded and deterministic", () => {
  const policy = resolveAdapterPolicy("core.web-audit.v1");
  assert.equal(withinRetryBudget(policy, 1), true);
  assert.equal(withinRetryBudget(policy, policy.maxAttempts), true);
  assert.equal(withinRetryBudget(policy, policy.maxAttempts + 1), false);
  assert.equal(withinRetryBudget(resolveAdapterPolicy("core.webhook.v1"), 1), false);
});

test("M9 a retryable failure is blocked once the adapter retry budget is exhausted", async () => {
  const adapterId = "test.m9-budget.v1";
  if (!capabilityAdapterList().some((adapter) => adapter.id === adapterId)) {
    registerCapabilityAdapter({
      id: adapterId,
      supports: (action) => action.id === "data.model",
      async execute() {
        const startedAt = new Date().toISOString();
        return { status: "FAILED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: "Transient.", errorCategory: "EXECUTION_FAILED", retryable: true };
      },
    } satisfies CapabilityAdapter);
  }
  registerAdapterBoundary({ adapterId, policy: { permission: "OBSERVE", timeoutMs: 1000, maxAttempts: 1, retryable: true } });

  const first = await executeCapabilityAction({ actionId: "data.model", approved: true, missionId: "m9-budget", idempotencyKey: "m9-budget-1" });
  assert.equal(first.status, "RETRYABLE");
  assert.equal(first.attempt, 1);

  const second = await executeCapabilityAction({ actionId: "data.model", approved: true, missionId: "m9-budget", idempotencyKey: "m9-budget-1" });
  assert.equal(second.status, "BLOCKED");
  assert.equal(second.retryable, false);
});

test("M9 adapter health reflects credential configuration without leaking secrets", () => {
  const webhook = capabilityAdapterList().find((adapter) => adapter.id === "core.webhook.v1")!;
  withEnv("CORE_ENGINE_WEBHOOK_ALLOWLIST", undefined, () => {
    assert.equal(adapterHealth(webhook), "UNCONFIGURED");
  });
  withEnv("CORE_ENGINE_WEBHOOK_ALLOWLIST", "https://hooks.example.com/", () => {
    assert.equal(adapterHealth(webhook), "READY");
  });
  const simulation = capabilityAdapterList().find((adapter) => adapter.id === SIMULATION_ID)!;
  assert.equal(adapterHealth(simulation), "READY");
});

test("M9 unregistering an adapter still yields a deterministic ADAPTER_NOT_FOUND", async () => {
  assert.equal(unregisterCapabilityAdapter(SIMULATION_ID), true);
  try {
    const resolution = resolveAdapterBoundary(getCapabilityAction("social.plan")!);
    assert.equal(resolution.ok, false);
    if (!resolution.ok) assert.equal(resolution.reason, "ADAPTER_NOT_FOUND");
  } finally {
    registerCapabilityAdapter({
      id: SIMULATION_ID,
      observationalOnly: true,
      supports: () => true,
      async execute(action) {
        const startedAt = new Date().toISOString();
        return { status: "EXECUTED", startedAt, completedAt: new Date().toISOString(), sideEffect: false, message: `Adapter accepted ${action.id}.`, output: { adapterId: SIMULATION_ID, actionId: action.id } };
      },
    });
  }
});
