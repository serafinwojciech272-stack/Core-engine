import test from "node:test";
import assert from "node:assert/strict";
import { buildContextEvidence } from "@/lib/context-evidence-runtime";

test("context and evidence remain traceable to supplied signals", () => {
  const { context, evidence } = buildContextEvidence({
    domain: "business",
    signals: [
      { name: "conversion_rate", value: "2.8%", source: "analytics" },
      { name: "traffic", value: "+18%", source: "analytics" }
    ],
    evidence: [
      { claim: "Conversion rate is 2.8%", source: "analytics", supports: true },
      { claim: "Traffic increased 18%", source: "analytics", supports: true }
    ],
    metadata: { request_id: "test-001" }
  });

  assert.equal(context.domain, "business");
  assert.equal(context.signals.length, 2);
  assert.equal(context.metadata.request_id, "test-001");
  assert.equal(evidence.length, 2);
  assert.ok(evidence.every((item) => item.id.startsWith("ev_")));
  assert.ok(evidence.every((item) => item.metadata?.source_registered === "true"));
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
