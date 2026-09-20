export type ProbabilitySource = "DERIVED";
export type CalibrationStatus = "UNCALIBRATED";

export type ProbabilityEstimate = {
  p1R: number;
  p2R: number;
  p3R: number;
  source: ProbabilitySource;
  calibration: CalibrationStatus;
  methodology: "deterministic-heuristic-v2";
  modelVersion: "probability-v1";
  sampleSize: null;
  interval: "UNAVAILABLE";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Stage 4 Probability Engine.
 * Produces bounded, monotonic R-multiple outcome estimates from the existing
 * deterministic trading features. These are NOT calibrated market probabilities.
 * Calibration remains explicitly unavailable until an outcome ledger exists.
 */
export function estimateTradingProbability(input: {
  confidence: number;
  edgeScore: number;
  volatilityPenalty: number;
  signalConflictDetected: boolean;
}): ProbabilityEstimate {
  const confidence = clamp(input.confidence, 0, 1);
  const edge = clamp(input.edgeScore, 0, 1);
  const conflictPenalty = input.signalConflictDetected ? 0.08 : 0;
  const volatilityPenalty = clamp(input.volatilityPenalty, 0, 0.35);

  const p1R = clamp(
    0.34 + confidence * 0.34 + edge * 0.08 - volatilityPenalty * 0.08 - conflictPenalty,
    0.05,
    0.78
  );
  const p2R = clamp(
    p1R * 0.62 + confidence * 0.08 - conflictPenalty * 0.35,
    0.03,
    0.58
  );
  const p3R = clamp(
    p2R * 0.62 + confidence * 0.04 - conflictPenalty * 0.2,
    0.01,
    0.42
  );

  return {
    p1R: Number(p1R.toFixed(3)),
    p2R: Number(Math.min(p2R, p1R).toFixed(3)),
    p3R: Number(Math.min(p3R, p2R).toFixed(3)),
    source: "DERIVED",
    calibration: "UNCALIBRATED",
    methodology: "deterministic-heuristic-v2",
    modelVersion: "probability-v1",
    sampleSize: null,
    interval: "UNAVAILABLE",
  };
}
