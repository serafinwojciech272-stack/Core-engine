import test from "node:test";
import assert from "node:assert/strict";
import { buildLessonCandidate, validateLessonCandidate, candidateKey } from "@/lib/learning-promotion";

test("M10.6 does not promote a single uncorroborated lesson", () => {
  const candidate = buildLessonCandidate({ lesson: "Improve checkout conversion", quality: "VERIFIED", domain: "business" });
  const result = validateLessonCandidate({ candidate, experiences: [] });
  assert.equal(result.status, "CANDIDATE");
  assert.equal(result.supportCount, 1);
});

test("M10.7 promotes only independently corroborated verified evidence", () => {
  const candidate = buildLessonCandidate({ lesson: "Improve checkout conversion", quality: "VERIFIED", domain: "business", missionId: "m-current" });
  const one = validateLessonCandidate({
    candidate,
    experiences: [
      { id: "e-current", mission_id: "m-current", outcome_quality: "VERIFIED", success: true, extracted_lessons: ["Improve checkout conversion"] }
    ]
  });
  assert.equal(one.status, "CANDIDATE");

  const two = validateLessonCandidate({
    candidate,
    experiences: [
      { id: "e-current", mission_id: "m-current", outcome_quality: "VERIFIED", success: true, extracted_lessons: ["Improve checkout conversion"] },
      { id: "e-prior", mission_id: "m-prior", outcome_quality: "VERIFIED", success: true, extracted_lessons: ["Improve checkout conversion"] }
    ]
  });
  assert.equal(two.status, "PROMOTED");
  assert.ok(two.confidence >= 0.7);
});

test("M10.7 rejects contradiction-dominated learning", () => {
  const candidate = buildLessonCandidate({ lesson: "Improve checkout conversion", quality: "VERIFIED", domain: "business" });
  const result = validateLessonCandidate({
    candidate,
    experiences: [
      { id: "e1", outcome_quality: "NEGATIVE", success: false, extracted_lessons: ["Improve checkout conversion"] },
      { id: "e2", outcome_quality: "NEGATIVE", success: false, extracted_lessons: ["Improve checkout conversion"] }
    ]
  });
  assert.equal(result.status, "REJECTED");
});

test("M10.6 candidate keys are deterministic", () => {
  assert.equal(candidateKey("  Improve   Checkout! ", "business"), candidateKey("improve checkout", "business"));
});
