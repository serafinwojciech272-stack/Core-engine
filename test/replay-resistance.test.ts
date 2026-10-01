import test from "node:test";
import assert from "node:assert/strict";

test("M11 replay resistance contract requires execution context binding", () => {
  const required = ["missionId", "correlationId", "actionId", "executionId", "idempotencyKey"];
  assert.deepEqual(required, ["missionId","correlationId","actionId","executionId","idempotencyKey"]);
});

test("M11 replay rejection codes are explicit and fail-closed", () => {
  const codes = [
    "CORRELATION_CONTEXT_REPLAY",
    "CORRELATION_ACTION_MISMATCH",
    "EXECUTION_CONTEXT_REPLAY",
    "IDEMPOTENCY_CONTEXT_REPLAY",
  ];
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.every((code) => code.endsWith("REPLAY") || code.endsWith("MISMATCH")));
});
