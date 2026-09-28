export type LearningQualityInput = {
  baselineSuccessRate: number | null;
  candidateSuccessRate: number | null;
  baselineAvgDeltaPct: number | null;
  candidateAvgDeltaPct: number | null;
  evidenceCount: number;
};

export type LearningQualityVerdict = "PASS" | "FAIL" | "HOLD";

export function evaluateLearningQuality(input: LearningQualityInput): {
  verdict: LearningQualityVerdict;
  reason: string;
} {
  if (input.evidenceCount < 2) {
    return { verdict: "HOLD", reason: "insufficient_evidence" };
  }
  if (input.candidateSuccessRate === null || input.candidateAvgDeltaPct === null) {
    return { verdict: "HOLD", reason: "incomplete_candidate_metrics" };
  }
  if (input.baselineSuccessRate !== null && input.candidateSuccessRate + 0.05 < input.baselineSuccessRate) {
    return { verdict: "FAIL", reason: "success_rate_regression_gt_5pp" };
  }
  if (input.baselineAvgDeltaPct !== null && input.candidateAvgDeltaPct < input.baselineAvgDeltaPct * 0.8) {
    return { verdict: "FAIL", reason: "outcome_delta_regression_gt_20pct" };
  }
  return { verdict: "PASS", reason: "candidate_within_regression_guard" };
}

export function shouldPromoteAfterEvaluation(
  verdict: LearningQualityVerdict,
  evidenceCount: number,
): boolean {
  return verdict === "PASS" && evidenceCount >= 2;
}
