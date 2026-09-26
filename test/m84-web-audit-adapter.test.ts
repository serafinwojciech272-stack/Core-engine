import test from "node:test";
import assert from "node:assert/strict";
import { executeCapabilityAction } from "@/lib/capability-action-registry";
import { listCapabilityAdapters } from "@/lib/capability-adapters";

test("M8.4 registers a real public web capability adapter", () => {
  assert.ok(listCapabilityAdapters().includes("core.web-audit.v1"));
});

test("M8.4 blocks private web targets before network access", async () => {
  const receipt = await executeCapabilityAction({
    actionId: "seo.audit",
    approved: true,
    missionId: "m84-private",
    idempotencyKey: "m84-private-1",
    input: { url: "http://127.0.0.1:8080" }
  });

  assert.equal(receipt.status, "FAILED");
  assert.equal(receipt.sideEffect, false);
  assert.match(receipt.message, /PRIVATE_URL_BLOCKED/);
});

test("M8.4 preserves the adapter receipt contract", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html><head><title>Example</title><meta name=\"description\" content=\"demo\"><meta name=\"viewport\" content=\"width=device-width\"><link rel=\"canonical\" href=\"https://example.com\"></head><body>ok</body></html>", { status: 200, headers: { "content-type": "text/html" } });
  try {
    const receipt = await executeCapabilityAction({
    actionId: "seo.audit",
    approved: true,
    missionId: "m84-contract",
    idempotencyKey: "m84-contract-1",
    input: { url: "https://example.com" }
  });

  assert.equal(receipt.executionMode, "ADAPTER");
  assert.equal(receipt.adapterId, "core.web-audit.v1");
  assert.equal(receipt.sideEffect, false);
  assert.ok(receipt.startedAt);
    assert.ok(receipt.completedAt);
    assert.equal(receipt.output?.httpStatus, 200);
    assert.equal(receipt.output?.title, "Example");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
