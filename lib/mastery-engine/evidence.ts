import { randomUUID } from "crypto";
import type { EvidenceRecord, MasteryLevel, SkillState } from "./contracts";

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function scoreToLevel(score: number): MasteryLevel {
  const s = clamp01(score);
  if (s < 0.2) return 0;
  if (s < 0.4) return 1;
  if (s < 0.6) return 2;
  if (s < 0.75) return 3;
  if (s < 0.9) return 4;
  return 5;
}

export function verifyEvidence(
  input: Omit<EvidenceRecord, "id" | "status" | "verifiedAt"> & {
    score: number;
    confidence: number;
  }
): EvidenceRecord {
  const now = new Date().toISOString();
  return {
    ...input,
    id: randomUUID(),
    status: "verified",
    score: clamp01(input.score),
    confidence: clamp01(input.confidence),
    verifiedAt: now,
  };
}

export function recomputeSkillState(
  current: SkillState,
  evidence: EvidenceRecord[]
): SkillState {
  const verified = evidence.filter((e) => e.status === "verified");

  if (!verified.length) {
    return {
      ...current,
      evidenceCount: evidence.length,
      verifiedEvidenceCount: 0,
    };
  }

  const weight =
    verified.reduce((sum, item) => sum + (item.confidence ?? 1), 0) || 1;

  const score =
    verified.reduce(
      (sum, item) => sum + (item.score ?? 0) * (item.confidence ?? 1),
      0
    ) / weight;

  const lastVerifiedAt =
    verified
      .map((item) => item.verifiedAt || item.submittedAt)
      .sort()
      .at(-1) ?? null;

  return {
    ...current,
    level: scoreToLevel(score),
    confidence: clamp01(
      verified.reduce((sum, item) => sum + (item.confidence ?? 0), 0) /
        verified.length
    ),
    evidenceCount: evidence.length,
    verifiedEvidenceCount: verified.length,
    lastVerifiedAt,
  };
}
