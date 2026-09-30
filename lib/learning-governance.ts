export const LESSON_STALE_AFTER_DAYS = 30;
export const LESSON_DECAY_PER_30_DAYS = 0.10;

export function lessonAgeDays(lastValidatedAt: string | null | undefined, now = Date.now()) {
  if (!lastValidatedAt) return Infinity;
  const parsed = Date.parse(lastValidatedAt);
  if (!Number.isFinite(parsed)) return Infinity;
  return Math.max(0, (now - parsed) / 86400000);
}

export function applyLessonConfidenceDecay(confidence: number, ageDays: number) {
  if (!Number.isFinite(confidence)) return 0;
  if (ageDays <= LESSON_STALE_AFTER_DAYS) return Math.max(0, Math.min(1, confidence));
  const periods = Math.floor(ageDays / LESSON_STALE_AFTER_DAYS);
  const factor = Math.pow(1 - LESSON_DECAY_PER_30_DAYS, periods);
  return Math.max(0, Math.min(1, confidence * factor));
}

export function governLessonStatus(input: {
  existingStatus?: "CANDIDATE" | "PROMOTED" | "REJECTED" | "STALE";
  lastValidatedAt?: string | null;
  validationStatus: "CANDIDATE" | "PROMOTED" | "REJECTED" | "STALE";
  now?: number;
}) {
  if (input.validationStatus === "PROMOTED" || input.validationStatus === "REJECTED") return input.validationStatus;
  if (input.validationStatus === "STALE") return "STALE" as const;
  const ageDays = lessonAgeDays(input.lastValidatedAt, input.now);
  if (ageDays > LESSON_STALE_AFTER_DAYS && input.existingStatus === "PROMOTED") return "STALE" as const;
  return input.existingStatus === "STALE" ? "STALE" as const : "CANDIDATE" as const;
}
