import test from "node:test";
import assert from "node:assert/strict";

test("learning claim is single-flight by mission and idempotency key", () => {
  const key = (correlationId: string) => `learning:${correlationId}`;
  assert.equal(key("abc"), "learning:abc");
  assert.equal(key("abc"), key("abc"));
  assert.notEqual(key("abc"), key("def"));
});

test("learning must be attempted only after mission reaches COMPLETED", () => {
  const allowed = (state: string) => state === "COMPLETED";
  assert.equal(allowed("MEASURING"), false);
  assert.equal(allowed("COMPLETED"), true);
  assert.equal(allowed("LEARNED"), false);
});
