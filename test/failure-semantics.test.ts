import test from "node:test";
import assert from "node:assert/strict";

type FailureCode = "CAPABILITY_EXECUTION_FAILED" | "VERIFICATION_FAILED" | "EXECUTION_LIFECYCLE_REJECTED";

function retryable(code: FailureCode) {
  return code === "CAPABILITY_EXECUTION_FAILED";
}

test("adapter execution failure is retryable", () => {
  assert.equal(retryable("CAPABILITY_EXECUTION_FAILED"), true);
});

test("verification failure is not automatically retryable", () => {
  assert.equal(retryable("VERIFICATION_FAILED"), false);
});

test("policy/lifecycle rejection is not automatically retryable", () => {
  assert.equal(retryable("EXECUTION_LIFECYCLE_REJECTED"), false);
});
