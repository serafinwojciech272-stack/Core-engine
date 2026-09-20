export type OutcomeQuality = "VERIFIED" | "NEGATIVE" | "UNVERIFIED";

export type OutcomeAssessment = {
  quality: OutcomeQuality;
  improved: boolean | null;
  delta: number | null;
  deltaPct: number | null;
  reason: string;
};

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function assessOutcome(outcome: Record<string, unknown>): OutcomeAssessment {
  const before = outcome.before;
  const after = outcome.after;
  const direction = outcome.direction === "lower" ? "lower" : "higher";

  if (!finiteNumber(before) || !finiteNumber(after)) {
    return { quality: "UNVERIFIED", improved: null, delta: null, deltaPct: null, reason: "Numeric before/after KPI values are required for automatic verification." };
  }

  const delta = after - before;
  const deltaPct = before === 0 ? null : (delta / Math.abs(before)) * 100;
  const improved = direction === "lower" ? after < before : after > before;

  return {
    quality: improved ? "VERIFIED" : "NEGATIVE",
    improved,
    delta,
    deltaPct,
    reason: improved ? "KPI moved in the expected direction." : "KPI did not move in the expected direction."
  };
}
