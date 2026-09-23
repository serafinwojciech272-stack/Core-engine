import test from "node:test";
import assert from "node:assert/strict";
import { validateCoreContract, validateConfidence } from "../lib/core-contracts.ts";
import { clearDomainRegistryForTests, listDomainPacks, registerDomainPack } from "../lib/domain-registry.ts";

test("core contracts reject a decision without evidence", () => {
  const result = validateCoreContract({
    id: "d1",
    domain: "business",
    diagnosis: { summary: "x", findings: [], evidenceIds: [], confidence: 0.7, assumptions: [] },
    options: [],
    recommendation: "review",
    confidence: 0.7,
    priority: "MEDIUM",
    risk: "LOW",
    assumptions: [],
    evidenceIds: [],
    reasoningSource: "DETERMINISTIC_RULES"
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("EVIDENCE_REQUIRED"));
});

test("confidence is bounded", () => {
  assert.equal(validateConfidence(-1), 0);
  assert.equal(validateConfidence(2), 1);
  assert.equal(validateConfidence(0.72), 0.72);
});

test("domain registry registers and retrieves packs", () => {
  clearDomainRegistryForTests();
  registerDomainPack({
    id: "test",
    version: "1",
    description: "test pack",
    signals: ["kpi"],
    diagnose: () => ({ summary: "ok", findings: [], evidenceIds: ["e1"], confidence: 0.8, assumptions: [] })
  });
  assert.equal(listDomainPacks().length, 1);
  assert.equal(listDomainPacks()[0].id, "test");
});
