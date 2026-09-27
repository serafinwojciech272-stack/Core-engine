import test from "node:test";
import assert from "node:assert/strict";
import { reflectOnWorldClaim, unknownKeyFromQuestion, worldClaimFreshness, worldContextLimit } from "@/lib/world-model-testable";
import { calculateConfidence } from "@/lib/provenance-intelligence";

test("M10.2 marks expired claims stale", () => {
  assert.equal(worldClaimFreshness({ status: "ACTIVE", valid_until: "2020-01-01T00:00:00Z", confidence: .9 }), "STALE");
});
test("M10.2 marks low confidence explicitly", () => {
  assert.equal(worldClaimFreshness({ status: "ACTIVE", confidence: .2 }), "KNOWN_WITH_LOW_CONFIDENCE");
});
test("M10.2 marks contradictory explicitly", () => {
  assert.equal(worldClaimFreshness({ status: "CONTRADICTORY", confidence: .9 }), "CONTRADICTORY");
});
test("M10.2 detects different claim values", () => {
  assert.equal(reflectOnWorldClaim({ a: { x: 1 }, b: { x: 2 } }), true);
  assert.equal(reflectOnWorldClaim({ a: { x: 1 }, b: { x: 1 } }), false);
});
test("M10.2 derives a stable unknown key from the question", () => {
  assert.equal(unknownKeyFromQuestion("What is the current business model?"), "what.is.the.current.business.model");
});
test("M10.2 bounds world context limits deterministically", () => {
  assert.equal(worldContextLimit(undefined), 10);
  assert.equal(worldContextLimit(0), 1);
  assert.equal(worldContextLimit(1000), 100);
  assert.equal(worldContextLimit(25), 25);
});
test("M10.3 confidence reasoning ignores an absent prior", () => {
  const strong = calculateConfidence({ authority: .9, reliability: .9, independence: .9, completeness: .9, directness: .9, freshness: .9, claimPrior: null });
  assert.equal(strong.reason, "Confidence supported across all provenance dimensions.");
  const weak = calculateConfidence({ authority: .9, reliability: .9, independence: .9, completeness: .9, directness: .2, freshness: .9, claimPrior: null });
  assert.match(weak.reason, /directness/);
});
