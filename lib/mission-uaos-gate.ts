import { createHash } from "node:crypto";

export type GateCertificationInput = {
  qualityCertified: boolean;
  qualityScore: number;
  missionState: string;
  osState: string;
  approvalId: string | null;
};

export type GateCertification = {
  certified: boolean;
  certificateId: string | null;
  reasons: string[];
  issuedAt: string;
  qualityScore: number;
  approvalId: string | null;
};

export function certifyMissionUAOSGate(input: GateCertificationInput): GateCertification {
  const reasons: string[] = [];
  if (!input.qualityCertified) reasons.push("QUALITY_NOT_CERTIFIED");
  if (!Number.isFinite(input.qualityScore) || input.qualityScore < 90) reasons.push("QUALITY_SCORE_BELOW_90");
  if (input.missionState !== "APPROVED") reasons.push("MISSION_NOT_APPROVED");
  if (input.osState !== "AWAITING_APPROVAL") reasons.push("UAOS_NOT_AWAITING_APPROVAL");
  if (!input.approvalId) reasons.push("UAOS_APPROVAL_MISSING");
  const certified = reasons.length === 0;
  const issuedAt = new Date().toISOString();
  const certificateId = certified
    ? "gate_" + createHash("sha256").update(JSON.stringify({ input, issuedAt })).digest("hex").slice(0, 24)
    : null;
  return { certified, certificateId, reasons, issuedAt, qualityScore: input.qualityScore, approvalId: input.approvalId };
}
