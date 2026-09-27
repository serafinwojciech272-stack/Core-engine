import test from "node:test";
import assert from "node:assert/strict";
import { reflectOnExperience } from "@/lib/intelligence-core";

test("M10 reflection promotes a verified improvement to reusable learning", () => {
  const result = reflectOnExperience({
    problem: "checkout conversion",
    hypothesis: "reducing checkout friction improves conversion",
    action: "remove unnecessary checkout step",
    expected: { before: 10, target: 12, direction: "higher" },
    actual: { before: 10, after: 13, direction: "higher" },
  });
  assert.equal(result.quality, "VERIFIED");
  assert.equal(result.success, true);
  assert.equal(result.delta, 3);
  assert.equal(result.deltaPct, 30);
  assert.equal(result.lessons.length, 1);
  assert.equal(result.strategies.length, 1);
});

test("M10 reflection keeps unmeasured outcomes out of successful learning", () => {
  const result = reflectOnExperience({ problem: "unknown outcome", action: "change process" });
  assert.equal(result.quality, "UNVERIFIED");
  assert.equal(result.success, null);
  assert.equal(result.delta, null);
  assert.match(result.lessons[0], /not sufficiently verified/i);
});

test("M10 reflection records negative learning for failed intervention", () => {
  const result = reflectOnExperience({
    problem: "response latency",
    expected: { before: 20, direction: "lower" },
    actual: { before: 20, after: 25, direction: "lower" },
  });
  assert.equal(result.quality, "NEGATIVE");
  assert.equal(result.success, false);
  assert.equal(result.delta, 5);
});