import { createHash } from "node:crypto";
import type { Context, Evidence } from "@/lib/core-contracts";

export type EvidenceInput = {
  id?: string;
  claim: string;
  source: string;
  supports?: boolean;
  timestamp?: string;
  metadata?: Record<string, string>;
};

function idFor(claim: string, source: string) {
  return "ev_" + createHash("sha256").update(claim + "\n" + source).digest("hex").slice(0, 16);
}

export function buildEvidence(
  context: Context,
  inputs: EvidenceInput[]
): Evidence[] {
  const allowedSources = new Set(context.signals.map((signal) => signal.source));
  return inputs
    .filter((item) => item.claim.trim() && item.source.trim())
    .map((item) => ({
      id: item.id || idFor(item.claim.trim(), item.source.trim()),
      claim: item.claim.trim().slice(0, 500),
      source: item.source.trim().slice(0, 200),
      supports: item.supports !== false,
      observedAt: item.timestamp,
      metadata: {
        ...item.metadata,
        source_registered: String(allowedSources.has(item.source))
      }
    }));
}

export function requireEvidence(evidence: Evidence[]): void {
  if (!evidence.length) throw new Error("EVIDENCE_REQUIRED");
  if (evidence.some((item) => !item.id || !item.claim || !item.source)) {
    throw new Error("EVIDENCE_INVALID");
  }
}
