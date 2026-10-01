import test from "node:test";
import assert from "node:assert/strict";

type State = "FAILED" | "APPROVED" | "EXECUTING" | "MEASURING";

function retryPath(state: State, actor: "human" | "system") {
  if (state === "FAILED" && actor === "human") return "APPROVED";
  if (state === "APPROVED" && actor === "system") return "EXECUTING";
  return null;
}

test("failed mission retry requires renewed human approval", () => {
  assert.equal(retryPath("FAILED", "human"), "APPROVED");
  assert.equal(retryPath("FAILED", "system"), null);
});

test("approved retry can enter execution through the atomic execution gate", () => {
  assert.equal(retryPath("APPROVED", "system"), "EXECUTING");
});

test("retry cannot bypass approval from failed state", () => {
  assert.notEqual(retryPath("FAILED", "system"), "EXECUTING");
  assert.notEqual(retryPath("FAILED", "human"), "EXECUTING");
});
