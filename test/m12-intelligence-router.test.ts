import test from "node:test";
import assert from "node:assert/strict";
import { routeIntelligenceTask } from "@/lib/m12-intelligence-router";

test("M12 routes simple tasks to a single registry model", () => {
  const route = routeIntelligenceTask("Napisz krótką odpowiedź na pytanie.");
  assert.equal(route.mode, "single");
  assert.ok(route.primaryModel);
  assert.ok(route.candidateModels.length >= 1);
});

test("M12 escalates technical complexity", () => {
  const route = routeIntelligenceTask("Zaprojektuj architekturę API, napraw błąd w TypeScript i przygotuj refaktoryzację repozytorium.");
  assert.equal(route.mode, "escalation");
  assert.ok(route.candidateModels.length >= 1);
});

test("M12 enables consensus for explicit multi-model verification", () => {
  const route = routeIntelligenceTask("Porównaj niezależnie dwa podejścia i wykonaj consensus drugiej opinii.");
  assert.equal(route.mode, "consensus");
  assert.ok(route.consensusModels.length >= 2);
});


test("M13 bounds context deterministically", async () => {
  const { buildContextEnvelope, serializeContextEnvelope } = await import("@/lib/m13-context-engine");
  const envelope = buildContextEnvelope("task", "x".repeat(1000), 120);
  assert.equal(envelope.version, "M13");
  assert.equal(envelope.truncated, true);
  assert.ok(serializeContextEnvelope(envelope).length <= 200);
});
