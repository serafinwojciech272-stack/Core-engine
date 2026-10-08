import test from "node:test";
import assert from "node:assert/strict";
import { seedMasteryProfile, seedMasteryRoadmap } from "@/lib/mastery-engine/seed";

test("AI Mastery seeds an evidence-based unassessed profile", () => {
  const profile = seedMasteryProfile();
  assert.equal(profile.currentLevel, "UNASSESSED");
  assert.equal(profile.overall, 0);
  assert.ok(profile.skills.length >= 10);
  assert.ok(profile.skills.every(skill => skill.evidenceCount === 0));
});

test("AI Mastery roadmap covers the full 2026-2031 horizon", () => {
  const roadmap = seedMasteryRoadmap();
  assert.equal(roadmap.horizon, "2026-2031");
  assert.equal(roadmap.stages.length, 12);
  assert.equal(roadmap.stages[0].status, "READY");
  assert.equal(roadmap.stages.at(-1)?.year, 2031);
});

test("skill gaps remain mathematically consistent at seed", () => {
  const profile = seedMasteryProfile();
  for (const skill of profile.skills) assert.equal(skill.gap, skill.target - skill.level);
});
