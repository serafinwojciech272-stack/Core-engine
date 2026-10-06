import test from "node:test";
import assert from "node:assert/strict";
import { fallbackAgent } from "@/app/api/agent/route";

test("marketing request produces a concrete 90-day plan", () => {
  const r = fallbackAgent("Zaprojektuj plan marketingowy na 90 dni", []);
  assert.equal(r.intent, "OPERATIONS_PLAN");
  assert.equal(r.execution, "HUMAN_APPROVAL_REQUIRED");
  assert.equal(r.plan.length, 5);
  assert.ok(r.reply.includes("90-dniowy"));
  assert.ok(r.kpis.includes("CAC"));
  assert.ok(r.deliverables.length >= 3);
  assert.ok(r.nextAction.includes("Mission"));
});

test("research wording is not misclassified as document analysis", () => {
  const r = fallbackAgent("Zbadaj ofertę konkurencji na rynku lokalnym", []);
  assert.equal(r.intent, "RESEARCH");
  assert.equal(r.capability, "Research & Web Intelligence");
});

test("document analysis without input blocks honestly", () => {
  const r = fallbackAgent("Przeanalizuj ten PDF i znajdź najważniejsze ryzyka", []);
  assert.equal(r.intent, "DOCUMENT_ANALYSIS");
  assert.equal(r.needsAttachment, true);
  assert.equal(r.requiresApproval, false);
  assert.ok(r.risks.includes("brak materiału źródłowego"));
});

test("build request returns deliverables and approval boundary", () => {
  const r = fallbackAgent("Utwórz stronę WWW dla firmy usługowej", []);
  assert.equal(r.intent, "WEB_BUILD");
  assert.ok(r.deliverables.length >= 3);
  assert.equal(r.execution, "HUMAN_APPROVAL_REQUIRED");
});