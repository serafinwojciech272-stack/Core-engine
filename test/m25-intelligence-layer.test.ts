import assert from "node:assert/strict";
import test from "node:test";
import { authorizeCoreEngineIntelligenceForM24, runCoreEngineIntelligence } from "../lib/m25-intelligence-layer";

test("M25 end-to-end routes, analyzes and bridges a sufficiently evidenced request", () => {
  const evidence = [
    "ticker/company",
    "financial statements",
    "valuation inputs",
    "market price",
  ];
  const result = runCoreEngineIntelligence({
    request: "Zrób DCF i analizę wyceny spółki",
    providedEvidence: evidence,
    assumptions: ["revenue growth"],
    risks: ["multiple compression"],
    dataFresh: true,
  });

  assert.equal(result.route.primaryDomain, "EQUITY");
  assert.equal(result.evidence.sufficient, true);
  assert.equal(result.intelligence.decision.decision, "ANALYZE");

  const authorized = authorizeCoreEngineIntelligenceForM24(result, "tenant-1", "request-1");
  assert.equal(authorized.m24Bridge?.allowed, true);
  assert.equal(authorized.m24Bridge?.state, "READY_FOR_M24");
  assert.ok(authorized.m24Bridge?.decisionHash);
});

test("M25 end-to-end fails closed when evidence is insufficient", () => {
  const result = runCoreEngineIntelligence({
    request: "Zrób DCF i analizę wyceny spółki",
    providedEvidence: [],
    dataFresh: false,
  });

  assert.equal(result.intelligence.decision.decision, "INSUFFICIENT_DATA");
  const authorized = authorizeCoreEngineIntelligenceForM24(result, "tenant-1", "request-2");
  assert.equal(authorized.m24Bridge?.allowed, false);
  assert.equal(authorized.m24Bridge?.state, "BLOCKED");
});
