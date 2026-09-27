export type CausalDecisionInput = {
  confidence: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  evidenceCount: number;
  recommendation: string;
  contradictions?: Array<{ status?: string; conflict_type?: string }>;
  unknowns?: Array<{ importance?: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"; status?: string }>;
  staleClaims?: Array<unknown>;
};

export type CausalDecisionAssessment = {
  method: "M10.4_CAUSAL_DECISION_GATE";
  originalConfidence: number;
  adjustedConfidence: number;
  decision: "PROCEED" | "MEASURE_FIRST" | "BLOCK";
  risk: "LOW" | "MEDIUM" | "HIGH";
  blockers: string[];
  warnings: string[];
  rationale: string[];
};

const clamp = (n:number) => Math.max(0, Math.min(1, n));

export function assessCausalDecision(input:CausalDecisionInput):CausalDecisionAssessment {
  const confidence = clamp(Number(input.confidence));
  const contradictions = (input.contradictions ?? []).filter(x => x.status === "OPEN");
  const criticalUnknowns = (input.unknowns ?? []).filter(x => x.status === "OPEN" && x.importance === "CRITICAL");
  const highUnknowns = (input.unknowns ?? []).filter(x => x.status === "OPEN" && x.importance === "HIGH");
  const stale = input.staleClaims?.length ?? 0;
  const blockers:string[] = [];
  const warnings:string[] = [];
  const rationale:string[] = [];
  let adjusted = confidence;

  if (contradictions.length) {
    adjusted -= Math.min(.30, contradictions.length * .10);
    warnings.push(`${contradictions.length} open contradiction(s) affect the decision context.`);
    rationale.push("Conflicting claims reduce causal confidence until resolved or explicitly accepted as uncertainty.");
  }
  if (criticalUnknowns.length) {
    adjusted -= Math.min(.25, criticalUnknowns.length * .12);
    blockers.push("CRITICAL_UNKNOWN");
    rationale.push("A critical unknown remains unresolved; high-impact execution should not rely on an unverified assumption.");
  } else if (highUnknowns.length) {
    adjusted -= Math.min(.15, highUnknowns.length * .05);
    warnings.push(`${highUnknowns.length} high-importance unknown(s) remain open.`);
  }
  if (stale) {
    adjusted -= Math.min(.15, stale * .03);
    warnings.push(`${stale} stale claim(s) are present in the decision context.`);
    rationale.push("Stale knowledge weakens causal attribution and should be refreshed before irreversible action.");
  }
  if (input.evidenceCount < 2) {
    adjusted -= .08;
    warnings.push("Evidence depth is below the minimum two-source threshold.");
  }

  adjusted = clamp(adjusted);

  let decision:CausalDecisionAssessment["decision"] = "PROCEED";
  if (criticalUnknowns.length || (contradictions.length >= 3 && adjusted < .65)) {
    decision = "BLOCK";
  } else if (contradictions.length || highUnknowns.length || stale || input.evidenceCount < 2 || adjusted < .65) {
    decision = "MEASURE_FIRST";
  }

  const risk:CausalDecisionAssessment["risk"] =
    decision === "BLOCK" || adjusted < .55 ? "HIGH" :
    decision === "MEASURE_FIRST" || adjusted < .75 ? "MEDIUM" : "LOW";

  if (decision === "PROCEED") rationale.push("Evidence and world-state quality are sufficient for a controlled decision.");
  if (decision === "MEASURE_FIRST") rationale.push("Run a bounded measurement or validation mission before committing to a high-impact intervention.");
  if (decision === "BLOCK") rationale.push("The current knowledge state contains a material unresolved dependency; execution should fail closed.");

  return {
    method:"M10.4_CAUSAL_DECISION_GATE",
    originalConfidence:confidence,
    adjustedConfidence:adjusted,
    decision,
    risk,
    blockers,
    warnings,
    rationale
  };
}
