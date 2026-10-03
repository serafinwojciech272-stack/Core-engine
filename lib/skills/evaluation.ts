export type EvaluationStatus = "PASS" | "FAIL" | "BLOCKED";

export interface SkillEvaluationScenario {
  id: string;
  description: string;
  expected: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface SkillEvaluationResult {
  scenarioId: string;
  status: EvaluationStatus;
  evidence: string[];
  notes?: string;
}

export interface SkillEvaluation {
  skillId: string;
  skillVersion: string;
  scenarios: SkillEvaluationScenario[];
  results: SkillEvaluationResult[];
  approvalRequired: true;
}

export function canPromoteEvaluation(evaluation: SkillEvaluation): boolean {
  return (
    evaluation.approvalRequired === true &&
    evaluation.scenarios.length > 0 &&
    evaluation.results.length === evaluation.scenarios.length &&
    evaluation.results.every((result) => result.status === "PASS")
  );
}
