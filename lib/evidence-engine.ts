import { createHash } from "node:crypto";
import type { Context, Evidence } from "@/lib/core-contracts";

export type EvidenceInput = {
  id?: string;
  claim: string;
  source: string;
  supports?: boolean;
  timestamp?: string;
  reliability?: number;
  metadata?: Record<string, string>;
};

function normalizeSource(source: string) {
  return source.trim().toLowerCase().replace(/\\s+/g, " ");
}

function idFor(claim: string, source: string) {
  return "ev_" + createHash("sha256").update(claim + "\n" + source).digest("hex").slice(0, 16);
}

function hashFor(claim: string, source: string, observedAt?: string) {
  return createHash("sha256").update([claim, source, observedAt ?? ""].join("\n")).digest("hex");
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function calculateFreshness(observedAt?: string, now = Date.now()) {
  if (!observedAt) return 0.5;
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return 0;
  const ageHours = Math.max(0, (now - timestamp) / 3_600_000);
  return Number(Math.exp(-ageHours / (24 * 7)).toFixed(4));
}

export function buildEvidence(
  context: Context,
  inputs: EvidenceInput[],
  now = Date.now()
): Evidence[] {
  const allowedSources = new Set(context.signals.map((signal) => normalizeSource(signal.source)));

  return inputs
    .filter((item) => item.claim.trim() && item.source.trim())
    .map((item) => {
      const claim = item.claim.trim().slice(0, 500);
      const source = item.source.trim().slice(0, 200);
      const registered = allowedSources.has(normalizeSource(source));
      const reliability = clamp(
        Number.isFinite(item.reliability ?? NaN)
          ? Number(item.reliability)
          : registered ? 0.8 : 0.4
      );
      return {
        id: item.id || idFor(claim, source),
        claim,
        source,
        supports: item.supports !== false,
        observedAt: item.timestamp,
        freshness: calculateFreshness(item.timestamp, now),
        reliability,
        provenance: {
          sourceType: item.metadata?.source_type,
          sourceRegistered: registered,
          hash: hashFor(claim, source, item.timestamp)
        },
        metadata: {
          ...item.metadata,
          source_registered: String(registered)
        }
      };
    });
}

export function requireEvidence(evidence: Evidence[]): void {
  if (!evidence.length) throw new Error("EVIDENCE_REQUIRED");
  if (evidence.some((item) => !item.id || !item.claim || !item.source)) {
    throw new Error("EVIDENCE_INVALID");
  }
}
