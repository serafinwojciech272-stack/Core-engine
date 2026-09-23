import type { Evidence } from "@/lib/core-contracts";

export type EvidenceGraphNode = {
  id: string;
  type: "evidence";
  claim: string;
  supports: boolean;
  reliability: number;
  freshness: number;
};

export type EvidenceGraphEdge = {
  from: string;
  to: string;
  type: "SUPPORTS" | "CONTRADICTS" | "SAME_CLAIM" | "SAME_SOURCE";
};

export type EvidenceGraph = {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  contradictions: string[][];
};

function claimKey(claim: string) {
  return claim
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż ]/gi, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

export function buildEvidenceGraph(evidence: Evidence[]): EvidenceGraph {
  const nodes = evidence.map((item) => ({
    id: item.id,
    type: "evidence" as const,
    claim: item.claim,
    supports: item.supports !== false,
    reliability: item.reliability ?? 0,
    freshness: item.freshness ?? 0
  }));

  const edges: EvidenceGraphEdge[] = [];
  const groups = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const key = claimKey(item.claim);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const contradictions: string[][] = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        edges.push({ from: a.id, to: b.id, type: "SAME_CLAIM" });
        if ((a.supports !== false) !== (b.supports !== false)) {
          edges.push({ from: a.id, to: b.id, type: "CONTRADICTS" });
          contradictions.push([a.id, b.id]);
        }
        if (a.source.toLowerCase() === b.source.toLowerCase()) {
          edges.push({ from: a.id, to: b.id, type: "SAME_SOURCE" });
        }
      }
    }
  }

  return { nodes, edges, contradictions };
}

export function evidenceGraphQuality(graph: EvidenceGraph) {
  const contradictionPenalty = Math.min(0.5, graph.contradictions.length * 0.1);
  const avgReliability = graph.nodes.length
    ? graph.nodes.reduce((sum, node) => sum + node.reliability, 0) / graph.nodes.length
    : 0;
  const avgFreshness = graph.nodes.length
    ? graph.nodes.reduce((sum, node) => sum + node.freshness, 0) / graph.nodes.length
    : 0;

  return {
    averageReliability: Number(avgReliability.toFixed(4)),
    averageFreshness: Number(avgFreshness.toFixed(4)),
    contradictionCount: graph.contradictions.length,
    score: Number(Math.max(0, avgReliability * 0.55 + avgFreshness * 0.45 - contradictionPenalty).toFixed(4))
  };
}
