import test from "node:test";
import assert from "node:assert/strict";
import { reflectOnWorldClaim, worldClaimFreshness } from "@/lib/world-model-testable";

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
