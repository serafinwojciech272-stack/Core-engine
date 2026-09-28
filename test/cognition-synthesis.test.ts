import test from "node:test";
import assert from "node:assert/strict";
import { decide, learn, understand } from "@/lib/cognition/synthesis";

function fakeClient(content: string) {
  return { complete: async () => ({ content, model: "test", latencyMs: 1, totalTokens: 1 }) };
}

test("understand maps structured language output", async () => {
  const result = await understand({
    tenantId: "tenant",
    text: "Tender deadline 30 October; criterion is price.",
    client: fakeClient(JSON.stringify({ summary: "Tender with deadline", signals: ["deadline"], requirements: ["submission"], deadlines: ["30 October"], criteria: ["price"], unknowns: ["budget"], confidence_notes: ["date is explicit"] })),
  });
  assert.equal(result.summary, "Tender with deadline");
  assert.deepEqual(result.deadlines, ["30 October"]);
});

test("decide preserves deterministic numeric and risk fields", async () => {
  const deterministic = {
    id: "d1", diagnosis: "deterministic", recommendation: "deterministic", confidence: .81,
    priority: "HIGH" as const, evidence: ["rule"], reasoningSource: "DETERMINISTIC_RULES" as const,
    probabilities: { p1R: .2, p2R: .3, p3R: .5 }, expectedR: 1.2, riskGate: "PASS" as const,
  };
  const result = await decide({
    tenantId: "tenant", context: { x: 1 }, deterministicDecision: deterministic,
    client: fakeClient(JSON.stringify({ diagnosis: "LLM diagnosis", recommendation: "LLM recommendation", confidence: 0 })),
  });
  assert.equal(result.diagnosis, "LLM diagnosis");
  assert.equal(result.recommendation, "LLM recommendation");
  assert.equal(result.confidence, .81);
  assert.equal(result.expectedR, 1.2);
  assert.equal(result.riskGate, "PASS");
  assert.equal(result.reasoningSource, "LLM");
});

test("learn is always a human-approval draft", async () => {
  const result = await learn({ tenantId: "tenant", outcome: { success: true }, client: fakeClient(JSON.stringify({ lesson: "Preserve verified pattern", evidence: ["outcome"] })) });
  assert.equal(result.requiresHumanApproval, true);
  assert.equal(result.lesson, "Preserve verified pattern");
});
