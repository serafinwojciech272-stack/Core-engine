export type ModelObservation = {
  modelKey: string;
  taskClass: string;
  outcomeQuality: "VERIFIED" | "NEGATIVE" | "UNVERIFIED";
  success: boolean | null;
  confidence: number | null;
  latencyMs?: number | null;
  costUnits?: number | null;
};

export function rankModelObservations(rows: ModelObservation[]) {
  const grouped = new Map<string, { modelKey:string; taskClass:string; evidence:number; verified:number; success:number; confidenceSum:number; latencySum:number; costSum:number; latencyN:number; costN:number }>();
  for (const row of rows) {
    const key = `${row.taskClass}::${row.modelKey}`;
    const g = grouped.get(key) ?? { modelKey:row.modelKey, taskClass:row.taskClass, evidence:0, verified:0, success:0, confidenceSum:0, latencySum:0, costSum:0, latencyN:0, costN:0 };
    g.evidence++;
    if (row.outcomeQuality === "VERIFIED") g.verified++;
    if (row.success === true) g.success++;
    if (row.confidence != null) g.confidenceSum += row.confidence;
    if (row.latencyMs != null) { g.latencySum += row.latencyMs; g.latencyN++; }
    if (row.costUnits != null) { g.costSum += row.costUnits; g.costN++; }
    grouped.set(key,g);
  }
  return [...grouped.values()].map(g => ({
    modelKey:g.modelKey, taskClass:g.taskClass, evidence:g.evidence,
    successRate:g.evidence ? g.success/g.evidence : 0,
    verifiedRate:g.evidence ? g.verified/g.evidence : 0,
    avgConfidence:g.confidenceSum && g.evidence ? g.confidenceSum/g.evidence : 0,
    avgLatencyMs:g.latencyN ? g.latencySum/g.latencyN : null,
    avgCostUnits:g.costN ? g.costSum/g.costN : null,
    score:(g.evidence >= 2 ? 0.45*(g.success/g.evidence)+0.35*(g.verified/g.evidence)+0.20*(g.confidenceSum/g.evidence) : 0)
  })).sort((a,b)=>b.score-a.score || b.evidence-a.evidence);
}

export function selectModel(ranked: ReturnType<typeof rankModelObservations>, taskClass: string) {
  const candidates = ranked.filter(x=>x.taskClass===taskClass && x.evidence>=2);
  return candidates[0] ?? null;
}
