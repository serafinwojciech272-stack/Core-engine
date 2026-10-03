import test from "node:test";
import assert from "node:assert/strict";
import { canPromoteEvaluation, type SkillEvaluation } from "@/lib/skills/evaluation";

const base: SkillEvaluation = {
  skillId: "demo",
  skillVersion: "1.0.0",
  approvalRequired: true,
  scenarios: [
    { id: "safe", description: "safe scenario", expected: "PASS", riskLevel: "LOW" },
    { id: "risk", description: "risk scenario", expected: "PASS", riskLevel: "HIGH" },
  ],
  results: [
    { scenarioId: "safe", status: "PASS", evidence: ["test"] },
    { scenarioId: "risk", status: "PASS", evidence: ["gate"] },
  ],
};

test("M11 evaluation promotes only complete passing evidence", () => {
  assert.equal(canPromoteEvaluation(base), true);
  assert.equal(
    canPromoteEvaluation({
      ...base,
      results: [{ scenarioId: "safe", status: "PASS", evidence: ["test"] }],
    }),
    false,
  );
  assert.equal(
    canPromoteEvaluation({
      ...base,
      results: [
        { scenarioId: "safe", status: "PASS", evidence: ["test"] },
        { scenarioId: "risk", status: "BLOCKED", evidence: ["approval"] },
      ],
    }),
    false,
  );
});
