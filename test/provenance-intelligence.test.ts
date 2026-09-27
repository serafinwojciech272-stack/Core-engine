import test from "node:test";
import assert from "node:assert/strict";
import { calculateConfidence, freshnessScore } from "@/lib/provenance-intelligence";

test("M10.3 decays freshness", () => {
  const now = new Date("2026-09-27T00:00:00Z").getTime();
  assert.equal(freshnessScore("2026-09-27T00:00:00Z", null, now), 1);
  assert.ok(freshnessScore("2026-08-28T00:00:00Z", null, now) < 0.4);
});

test("M10.3 expires at freshness boundary", () => {
  const now = new Date("2026-09-27T00:00:00Z").getTime();
  assert.equal(freshnessScore("2026-09-27T00:00:00Z", "2026-09-26T00:00:00Z", now), 0);
});

test("M10.3 confidence is bounded", () => {
  const x = calculateConfidence({ authority: 1, reliability: 1, independence: 1, completeness: 1, directness: 1, freshness: 1 });
  assert.ok(x.score <= 1);
  assert.ok(x.score > .8);
});

test("M10.3 weak evidence is surfaced", () => {
  const result = calculateConfidence({ authority: .2, reliability: .4, independence: .5, completeness: .9, directness: .9, freshness: .9 });
  assert.ok(result.reason.includes("authority"));
});
