import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTerminalRecoveryClosure } from "@/lib/m24-37-terminal-recovery-closure";

test("M24.37 closes only when every control-plane prerequisite is satisfied", () => {
  const result = evaluateTerminalRecoveryClosure({
    tenantId: "t1",
    recoveryKey: "r1",
    approvalPermission: "GRANTED",
    executionPermission: "GRANTED",
    reconciliationPassed: true,
    verificationPassed: true,
    learningPromoted: true,
  });
  assert.equal(result.terminal, true);
  assert.equal(result.state, "CLOSED");
  assert.equal(result.failures.length, 0);
  assert.equal(result.closureHash.length, 64);
});

test("M24.37 fails closed when any terminal prerequisite is missing", () => {
  const result = evaluateTerminalRecoveryClosure({
    tenantId: "t1",
    recoveryKey: "r1",
    approvalPermission: "GRANTED",
    executionPermission: "GRANTED",
    reconciliationPassed: true,
    verificationPassed: false,
    learningPromoted: true,
  });
  assert.equal(result.terminal, false);
  assert.equal(result.state, "CLOSE_BLOCKED");
  assert.deepEqual(result.failures, ["POST_EXECUTION_VERIFICATION_FAILED"]);
});

test("M24.37 rejects denied execution even when learning exists", () => {
  const result = evaluateTerminalRecoveryClosure({
    tenantId: "t1",
    recoveryKey: "r1",
    approvalPermission: "GRANTED",
    executionPermission: "DENIED",
    reconciliationPassed: true,
    verificationPassed: true,
    learningPromoted: true,
  });
  assert.equal(result.terminal, false);
  assert.deepEqual(result.failures, ["EXECUTION_NOT_GRANTED"]);
});
