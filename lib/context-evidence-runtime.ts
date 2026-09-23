import type { Context, Evidence } from "@/lib/core-contracts";
import { buildContext, type RawSignal, validateContext } from "@/lib/context-engine";
import { buildEvidence, requireEvidence, type EvidenceInput } from "@/lib/evidence-engine";

export type ContextEvidenceInput = {
  signals: RawSignal[];
  evidence: EvidenceInput[];
  domain?: string;
  metadata?: Record<string, string>;
};

export function buildContextEvidence(input: ContextEvidenceInput): {
  context: Context;
  evidence: Evidence[];
} {
  const context = buildContext(input.signals, input.domain, input.metadata);
  validateContext(context);
  const evidence = buildEvidence(context, input.evidence);
  requireEvidence(evidence);
  return { context, evidence };
}
