import test from "node:test";
import assert from "node:assert/strict";
import { capabilityRequestHash } from "@/lib/capability-execution-ledger";

test("M9.4 produces deterministic request hashes independent of object key order", () => {
  const a = capabilityRequestHash({
    actionId: "integration.webhook.dispatch",
    missionId: "mission-1",
    input: { payload: { z: 2, a: 1 }, url: "https://example.com/hook" },
  });
  const b = capabilityRequestHash({
    input: { url: "https://example.com/hook", payload: { a: 1, z: 2 } },
    missionId: "mission-1",
    actionId: "integration.webhook.dispatch",
  });
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("M9.4 changes to request payload change the idempotency fingerprint", () => {
  const a = capabilityRequestHash({
    actionId: "integration.webhook.dispatch",
    missionId: "mission-1",
    input: { payload: { value: 1 } },
  });
  const b = capabilityRequestHash({
    actionId: "integration.webhook.dispatch",
    missionId: "mission-1",
    input: { payload: { value: 2 } },
  });
  assert.notEqual(a, b);
});
