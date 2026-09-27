import test from "node:test";
import assert from "node:assert/strict";
import { listCapabilityActions } from "@/lib/capability-action-registry";
import { resolveCapabilityAdapter } from "@/lib/capability-adapters";
import type { CapabilityAction } from "@/lib/capability-contracts";

test("M9.3 registers the controlled webhook integration capability", () => {
  const action = listCapabilityActions().find((item) => item.id === "integration.webhook.dispatch");
  assert.ok(action);
  assert.equal(action.requiresApproval, true);
  assert.equal(action.risk, "HIGH");
  const adapter = resolveCapabilityAdapter(action as CapabilityAction);
  assert.equal(adapter?.id, "core.webhook.v1");
});

test("M9.3 blocks webhook execution without an allowlist", async () => {
  const adapter = resolveCapabilityAdapter({ id: "integration.webhook.dispatch", name: "x", description: "x", risk: "HIGH", requiresApproval: true, inputs: [], outputs: [] });
  assert.ok(adapter);
  const old = process.env.CORE_ENGINE_WEBHOOK_ALLOWLIST;
  delete process.env.CORE_ENGINE_WEBHOOK_ALLOWLIST;
  await assert.rejects(() => adapter!.execute({ id: "integration.webhook.dispatch", name: "x", description: "x", risk: "HIGH", requiresApproval: true, inputs: [], outputs: [] }, { idempotencyKey: "test-1", input: { url: "https://example.com/hook", payload: { ok: true } } }), /WEBHOOK_ALLOWLIST_NOT_CONFIGURED/);
  if (old === undefined) delete process.env.CORE_ENGINE_WEBHOOK_ALLOWLIST; else process.env.CORE_ENGINE_WEBHOOK_ALLOWLIST = old;
});
