import { evaluateLearningQuality, shouldPromoteAfterEvaluation } from "../lib/learning-quality-gate";

describe("M11.5 learning quality gate", () => {
  it("holds when evidence is insufficient", () => {
    expect(evaluateLearningQuality({
      baselineSuccessRate: 0.8,
      candidateSuccessRate: 0.9,
      baselineAvgDeltaPct: 10,
      candidateAvgDeltaPct: 12,
      evidenceCount: 1,
    }).verdict).toBe("HOLD");
  });

  it("fails a material success-rate regression", () => {
    expect(evaluateLearningQuality({
      baselineSuccessRate: 0.8,
      candidateSuccessRate: 0.74,
      baselineAvgDeltaPct: 10,
      candidateAvgDeltaPct: 10,
      evidenceCount: 3,
    }).verdict).toBe("FAIL");
  });

  it("fails a material outcome-delta regression", () => {
    expect(evaluateLearningQuality({
      baselineSuccessRate: 0.8,
      candidateSuccessRate: 0.82,
      baselineAvgDeltaPct: 10,
      candidateAvgDeltaPct: 7,
      evidenceCount: 3,
    }).verdict).toBe("FAIL");
  });

  it("passes a sufficiently evidenced candidate within guardrails", () => {
    const result = evaluateLearningQuality({
      baselineSuccessRate: 0.8,
      candidateSuccessRate: 0.82,
      baselineAvgDeltaPct: 10,
      candidateAvgDeltaPct: 9,
      evidenceCount: 3,
    });
    expect(result.verdict).toBe("PASS");
    expect(shouldPromoteAfterEvaluation(result.verdict, 3)).toBe(true);
  });
});