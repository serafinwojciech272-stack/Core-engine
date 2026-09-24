import test from "node:test";
import assert from "node:assert/strict";
import { buildContextEvidence } from "../lib/context-evidence-runtime.ts";

test("context and evidence expose provenance, freshness, reliability and graph quality", () => {
  const { context, evidence, evidenceGraph, evidenceQuality } = buildContextEvidence({
    domain: "business",
    signals: [
      { name: "conversion_rate", value: "2.8%", source: "Analytics" },
      { name: "traffic", value: "+18%", source: "analytics" }
    ],
    evidence: [
      { claim: "Conversion rate is 2.8%", source: "analytics", supports: true, timestamp: "2026-09-23T12:00:00Z", reliability: 0.9 },
      { claim: "Conversion rate is 2.8%", source: "analytics", supports: false, timestamp: "2026-09-23T12:00:00Z", reliability: 0.8 }
    ],
    metadata: { request_id: "test-001" },
    now: Date.parse("2026-09-23T13:00:00Z")
  });

  assert.equal(context.domain, "business");
  assert.equal(context.signals.length, 2);
  assert.equal(context.metadata?.request_id, "test-001");
  assert.equal(evidence.length, 2);
  assert.ok(evidence.every((item) => item.id.startsWith("ev_")));
  assert.ok(evidence.every((item) => item.provenance?.sourceRegistered));
  assert.ok(evidence.every((item) => (item.freshness ?? 0) > 0.9));
  assert.equal(evidenceGraph.contradictions.length, 1);
  assert.equal(evidenceQuality.contradictionCount, 1);
});

test("unregistered evidence remains traceable but receives lower default reliability", () => {
  const { evidence } = buildContextEvidence({
    signals: [{ name: "conversion_rate", value: "2.8%", source: "analytics" }],
    evidence: [{ claim: "External claim", source: "external-source" }],
    now: Date.parse("2026-09-23T13:00:00Z")
  });
  assert.equal(evidence[0].provenance?.sourceRegistered, false);
  assert.equal(evidence[0].reliability, 0.4);
});

test("empty evidence is rejected instead of allowing evidence-free diagnosis", () => {
  assert.throws(
    () => buildContextEvidence({
      signals: [{ name: "conversion_rate", value: "2.8%", source: "analytics" }],
      evidence: []
    }),
    /EVIDENCE_REQUIRED/
  );
});
