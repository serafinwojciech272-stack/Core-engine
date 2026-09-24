import test from "node:test";
import assert from "node:assert/strict";
import { businessDomainPack } from "../lib/domain-packs/business";

test("business domain pack diagnoses qualified leads and builds a mission", async () => {
  const diagnosis = await businessDomainPack.diagnose(
    {
      domain: "business",
      signals: [
        { name: "qualified_leads", value: "84", source: "crm" },
        { name: "conversion_rate", value: "2.8%", source: "analytics" }
      ]
    },
    [
      { id: "e1", claim: "84 qualified leads", source: "crm", supports: true },
      { id: "e2", claim: "2.8% conversion", source: "analytics", supports: true }
    ]
  );

  assert.match(diagnosis.summary, /Lead/);
  assert.equal(diagnosis.evidenceIds.length, 2);
  assert.ok(diagnosis.confidence >= 0 && diagnosis.confidence <= 1);

  const mission = await businessDomainPack.buildMission?.({
    id: "decision-1",
    domain: "business",
    diagnosis,
    options: [],
    recommendation: "Run a controlled sales-response experiment.",
    confidence: diagnosis.confidence,
    priority: "HIGH",
    risk: "LOW",
    assumptions: diagnosis.assumptions,
    evidenceIds: diagnosis.evidenceIds,
    reasoningSource: "DETERMINISTIC_RULES"
  });

  assert.ok(mission);
  assert.equal(mission?.domain, "business");
  assert.equal(mission?.kpi, "lead_to_opportunity_rate");
  assert.equal(mission?.requiredApproval, true);
  assert.equal(mission?.state, "AWAITING_APPROVAL");
});
