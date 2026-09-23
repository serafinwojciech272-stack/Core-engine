import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceGraph, evidenceGraphQuality } from "@/lib/evidence-graph";
import type { Evidence } from "@/lib/core-contracts";

function ev(id: string, supports: boolean, reliability = 0.9, freshness = 0.9): Evidence {
  return {
    id,
    claim: "Conversion rate is 2.8%",
    source: "analytics",
    supports,
    reliability,
    freshness
  };
}

test("evidence graph detects contradiction and preserves provenance quality", () => {
  const graph = buildEvidenceGraph([ev("ev_a", true), ev("ev_b", false)]);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.contradictions.length, 1);
  assert.ok(graph.edges.some((edge) => edge.type === "CONTRADICTS"));
  const quality = evidenceGraphQuality(graph);
  assert.equal(quality.contradictionCount, 1);
  assert.ok(quality.score < 0.9);
});

test("evidence graph quality penalizes stale or unreliable evidence", () => {
  const graph = buildEvidenceGraph([ev("ev_a", true, 0.2, 0.1)]);
  const quality = evidenceGraphQuality(graph);
  assert.equal(quality.averageReliability, 0.2);
  assert.equal(quality.averageFreshness, 0.1);
  assert.ok(quality.score < 0.3);
});
