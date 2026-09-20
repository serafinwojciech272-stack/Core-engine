import type { OutcomeAssessment } from "@/lib/outcome-quality";

export type LearningLesson = {
  lessonType: "POSITIVE_DELTA" | "NEGATIVE_DELTA" | "UNVERIFIED";
  quality: OutcomeAssessment["quality"];
  improved: boolean | null;
  delta: number | null;
  deltaPct: number | null;
  lesson: string;
  reason: string;
};

export function buildLearningLesson(
  assessment: OutcomeAssessment,
  context: { missionObjective?: string; kpi?: string } = {}
): LearningLesson {
  const subject = context.kpi || context.missionObjective || "mission KPI";

  if (assessment.quality === "VERIFIED") {
    return {
      lessonType: "POSITIVE_DELTA",
      quality: assessment.quality,
      improved: assessment.improved,
      delta: assessment.delta,
      deltaPct: assessment.deltaPct,
      lesson: `The approved intervention improved ${subject}; preserve the causal pattern for future decisions.`,
      reason: assessment.reason
    };
  }

  if (assessment.quality === "NEGATIVE") {
    return {
      lessonType: "NEGATIVE_DELTA",
      quality: assessment.quality,
      improved: assessment.improved,
      delta: assessment.delta,
      deltaPct: assessment.deltaPct,
      lesson: `The approved intervention did not improve ${subject}; reduce confidence in this pattern and require reassessment before reuse.`,
      reason: assessment.reason
    };
  }

  return {
    lessonType: "UNVERIFIED",
    quality: assessment.quality,
    improved: assessment.improved,
    delta: assessment.delta,
    deltaPct: assessment.deltaPct,
    lesson: `The outcome for ${subject} could not be automatically verified; do not treat it as a successful learning signal.`,
    reason: assessment.reason
  };
}
