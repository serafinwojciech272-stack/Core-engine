import test from "node:test";
import assert from "node:assert/strict";
import { applyLessonConfidenceDecay, governLessonStatus } from "@/lib/learning-governance";

test("M10.9 keeps fresh confidence stable", () => {
  assert.equal(applyLessonConfidenceDecay(0.8, 20), 0.8);
});

test("M10.9 decays stale confidence deterministically", () => {
  assert.equal(Number(applyLessonConfidenceDecay(0.8, 60).toFixed(3)), 0.648);
});

test("M10.9 marks old promoted knowledge stale when it loses corroboration", () => {
  const now = Date.parse("2026-09-30T00:00:00Z");
  const old = new Date(now - 31 * 86400000).toISOString();
  assert.equal(governLessonStatus({
    existingStatus: "PROMOTED",
    lastValidatedAt: old,
    validationStatus: "CANDIDATE",
    now
  }), "STALE");
});

test("M10.9 never downgrades fresh explicit promotion", () => {
  assert.equal(governLessonStatus({
    existingStatus: "PROMOTED",
    lastValidatedAt: new Date().toISOString(),
    validationStatus: "PROMOTED"
  }), "PROMOTED");
});
