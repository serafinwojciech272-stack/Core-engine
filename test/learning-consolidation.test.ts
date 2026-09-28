import test from "node:test";
import assert from "node:assert/strict";
import { shouldActivateConsolidatedStrategy } from "../lib/learning-consolidation";

test("M11.4 activates only verified repeated recovery patterns", () => {
  assert.equal(shouldActivateConsolidatedStrategy({ status: "ACTIVE", evidence_count: 2, success_rate: 0.7 }), true);
  assert.equal(shouldActivateConsolidatedStrategy({ status: "ACTIVE", evidence_count: 1, success_rate: 1 }), false);
  assert.equal(shouldActivateConsolidatedStrategy({ status: "ACTIVE", evidence_count: 3, success_rate: 0.66 }), false);
});

test("M11.4 keeps experimental or deprecated patterns out of reusable strategy", () => {
  assert.equal(shouldActivateConsolidatedStrategy({ status: "EXPERIMENTAL", evidence_count: 5, success_rate: 1 }), false);
  assert.equal(shouldActivateConsolidatedStrategy({ status: "DEPRECATED", evidence_count: 5, success_rate: 1 }), false);
  assert.equal(shouldActivateConsolidatedStrategy({ status: "ACTIVE", evidence_count: 2, success_rate: null }), false);
});
