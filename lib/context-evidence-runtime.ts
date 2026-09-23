import type { Context, Evidence } from "@/lib/core-contracts";
import { buildContext, type RawSignal, validateContext } from "@/lib/context-engine";
import { buildEvidence, requireEvidence, type EvidenceInput } from "@/lib/evidence-engine";
import { buildEvidenceGraph, evidenceGraphQuality, type EvidenceGraph } from "@/lib/evidence-graph";

export type ContextEvidenceInput = {
  signals: RawSignal[];
  evidence: EvidenceInput[];
  domain?: string;
  metadata?: Record<string, string>;
  now?: number;
};

export type ContextEvidenceResult = {
  context: Context;
  evidence: Evidence[];
  evidenceGraph: EvidenceGraph;
  evidenceQuality: ReturnType<typeof evidenceGraphQuality>;
};

export function buildContextEvidence(input: ContextEvidenceInput): ContextEvidenceResult {
  const context = buildContext(input.signals, input.domain, input.metadata);
  validateContext(context);
  const evidence = buildEvidence(context, input.evidence, input.now);
  requireEvidence(evidence);
  const evidenceGraph = buildEvidenceGraph(evidence);
  return {
    context,
    evidence,
    evidenceGraph,
    evidenceQuality: evidenceGraphQuality(evidenceGraph)
  };
}
