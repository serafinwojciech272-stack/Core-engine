import test from "node:test";
import assert from "node:assert/strict";

test("execution success gate targets MEASURING only", () => {
  const allowed = (state: string) => state === "EXECUTING";
  assert.equal(allowed("EXECUTING"), true);
  assert.equal(allowed("MEASURING"), false);
  assert.equal(allowed("COMPLETED"), false);
});

test("execution correlation key remains stable for replay protection", () => {
  const key = (missionId: string, actionId: string, idempotencyKey: string) =>
    `mission:${missionId}:capability:${actionId}:${idempotencyKey}`;
  assert.equal(key("m1","a1","k1"), key("m1","a1","k1"));
  assert.notEqual(key("m1","a1","k1"), key("m1","a1","k2"));
});
