import test from "node:test";
import assert from "node:assert/strict";
import { adaptLearning } from "@/lib/mastery-engine/adaptive";

test("adaptive engine prioritizes the largest gap and maps action kind to level", () => {
  const decision = adaptLearning({
    tenantId: "test",
    skills: [
      { id: "a", name: "Foundations", domain: "computer-science", difficulty: 5, dependencies: [], tags: [] },
      { id: "b", name: "Agents", domain: "agent-engineering", difficulty: 2, dependencies: [], tags: [] }
    ],
    states: [
      { id: "a", skillId: "a", name: "Foundations", domain: "computer-science", level: 1, target: 5, confidence: 0.2, gap: 4, prerequisites: [], evidenceCount: 1, verifiedEvidenceCount: 1, lastVerifiedAt: null, nextAction: "" },
      { id: "b", skillId: "b", name: "Agents", domain: "agent-engineering", level: 4, target: 5, confidence: 0.9, gap: 1, prerequisites: [], evidenceCount: 4, verifiedEvidenceCount: 4, lastVerifiedAt: null, nextAction: "" }
    ],
    goals: [{ id: "a", title: "Foundations", targetLevel: 5, priority: 4 }, { id: "b", title: "Agents", targetLevel: 5, priority: 1 }],
    reason: "evidence"
  });
  assert.equal(decision.reason, "evidence");
  assert.equal(decision.actions[0]?.skillId, "a");
  assert.equal(decision.actions[0]?.kind, "learn");
});

test("adaptive engine blocks skills whose prerequisites are not ready", () => {
  const decision = adaptLearning({
    tenantId: "test",
    skills: [
      { id: "base", name: "Base", domain: "computer-science", difficulty: 2, dependencies: [], tags: [] },
      { id: "advanced", name: "Advanced", domain: "agent-engineering", difficulty: 5, dependencies: ["base"], tags: [] }
    ],
    states: [
      { id: "base", skillId: "base", name: "Base", domain: "computer-science", level: 1, target: 5, confidence: 0.4, gap: 4, prerequisites: [], evidenceCount: 1, verifiedEvidenceCount: 1, lastVerifiedAt: null, nextAction: "" },
      { id: "advanced", skillId: "advanced", name: "Advanced", domain: "agent-engineering", level: 0, target: 5, confidence: 0, gap: 5, prerequisites: ["base"], evidenceCount: 0, verifiedEvidenceCount: 0, lastVerifiedAt: null, nextAction: "" }
    ],
    goals: [{ id: "base", title: "Base", targetLevel: 5, priority: 4 }, { id: "advanced", title: "Advanced", targetLevel: 5, priority: 5 }]
  });
  assert.ok(!decision.selectedSkillIds.includes("advanced"));
});