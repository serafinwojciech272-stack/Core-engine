type DbConfig = { url: string; key: string };
function cfg(): DbConfig {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return { url, key };
}
function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
async function db(path: string, init: RequestInit = {}) {
  const c = cfg();
  const response = await fetch(`${c.url}/rest/v1/${path}`, {
    ...init, cache: "no-store", headers: { ...headers(c.key), ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error(`STRATEGY_EVOLUTION_DB_${response.status}`);
  return response;
}

export type StrategyEvolutionInput = {
  strategyId: string;
  name: string;
  problemPattern: string;
  evidenceCount: number;
  successRate: number | null;
  avgDeltaPct: number | null;
  confidence: number | null;
  status: "EXPERIMENTAL" | "ACTIVE" | "DEPRECATED";
};

export function buildStrategyEvolutionProposal(input: StrategyEvolutionInput) {
  if (input.status === "DEPRECATED") return { proposalType: "DEPRECATION" as const, title: "Deprecation review", rationale: "Strategy is already deprecated; no automatic reuse should occur.", proposedChanges: { action: "freeze_reuse" }, expectedImpact: { risk: "lower" } };
  if (input.evidenceCount < 2) return { proposalType: "IMPROVEMENT" as const, title: "Evidence expansion", rationale: "Strategy has insufficient evidence for safe evolution.", proposedChanges: { action: "collect_more_evidence", minimumEvidence: 2 }, expectedImpact: { confidence: "increase" } };
  if ((input.successRate ?? 0) < 0.7) return { proposalType: "IMPROVEMENT" as const, title: "Recovery-oriented strategy revision", rationale: "Observed success rate is below the activation threshold.", proposedChanges: { action: "revise_steps", require_new_experiment: true }, expectedImpact: { successRate: "increase" } };
  if ((input.avgDeltaPct ?? 0) > 0 && (input.successRate ?? 0) >= 0.85) return { proposalType: "SPECIALIZATION" as const, title: "Specialize high-performing strategy", rationale: "Repeated positive evidence supports testing a narrower applicability boundary.", proposedChanges: { action: "narrow_applicability", preserve_parent: true }, expectedImpact: { precision: "increase" } };
  return { proposalType: "IMPROVEMENT" as const, title: "Controlled strategy improvement", rationale: "Strategy has evidence but should evolve only through a governed experiment.", proposedChanges: { action: "design_reversible_experiment", preserve_parent: true }, expectedImpact: { expectedDeltaPct: input.avgDeltaPct ?? 0 } };
}

export async function proposeStrategyEvolution(tenantId: string, input: StrategyEvolutionInput) {
  const proposal = buildStrategyEvolutionProposal(input);
  const body = {
    tenant_id: tenantId, strategy_id: input.strategyId, proposal_type: proposal.proposalType,
    title: proposal.title, rationale: proposal.rationale, proposed_changes: proposal.proposedChanges,
    expected_impact: proposal.expectedImpact, confidence: input.confidence, evidence_count: input.evidenceCount,
    status: "PROPOSED", source_evaluation_ids: [],
  };
  const response = await db("ce_intelligence_strategy_proposals", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  const rows = await response.json() as unknown[];
  return rows[0] ?? null;
}
