import test from "node:test";
import assert from "node:assert/strict";
import {externalWebhookAdapter} from "../lib/external-webhook-adapter.ts";

const action = {
  id: "external.webhook.dispatch",
  name: "Dispatch external webhook action",
  description: "test",
  risk: "HIGH" as const,
  requiresApproval: true,
  inputs: ["payload"],
  outputs: ["http_status", "response_body"]
};

test("external webhook adapter refuses execution without idempotency", async () => {
  const receipt = await externalWebhookAdapter.execute(action, {missionId:"m1", input:{x:1}});
  assert.equal(receipt.status, "REJECTED");
  assert.equal(receipt.sideEffect, false);
});

test("external webhook adapter reports disabled configuration without side effect", async () => {
  const previous = process.env.CORE_ACTION_WEBHOOK_URL;
  delete process.env.CORE_ACTION_WEBHOOK_URL;
  const receipt = await externalWebhookAdapter.execute(action, {missionId:"m1", idempotencyKey:"k1", input:{x:1}});
  if (previous !== undefined) process.env.CORE_ACTION_WEBHOOK_URL = previous;
  assert.equal(receipt.status, "REJECTED");
  assert.equal(receipt.sideEffect, false);
});

test("external webhook adapter rejects non-https endpoints", async () => {
  const previous = process.env.CORE_ACTION_WEBHOOK_URL;
  process.env.CORE_ACTION_WEBHOOK_URL = "http://example.com/hook";
  const receipt = await externalWebhookAdapter.execute(action, {missionId:"m1", idempotencyKey:"k1"});
  if (previous === undefined) delete process.env.CORE_ACTION_WEBHOOK_URL;
  else process.env.CORE_ACTION_WEBHOOK_URL = previous;
  assert.equal(receipt.status, "FAILED");
  assert.equal(receipt.sideEffect, false);
});
