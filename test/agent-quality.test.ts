import test from "node:test";
import assert from "node:assert/strict";
import { QUALITY_CASES, certifyQuality } from "@/lib/agent-quality";
import { fallbackAgent } from "@/app/api/agent/route";
import { createOSRun, transitionOS, attachApproval, certifyApprovalGate } from "@/lib/universal-agent-os";

test("Core Engine quality suite certifies deterministic fallback", () => {
  const outputs: Record<string, any> = {};
  for (const c of QUALITY_CASES) outputs[c.id] = fallbackAgent(c.task, []);
  const report = certifyQuality(outputs);
  assert.equal(report.certified, true);
  assert.equal(report.failed, 0);
  assert.equal(report.score, 100);
});

test("quality catches fabricated side effects", () => {
  const c = QUALITY_CASES[0];
  const outputs: Record<string, any> = {};
  for (const item of QUALITY_CASES) outputs[item.id] = fallbackAgent(item.task, []);
  outputs[c.id] = { ...outputs[c.id], reply: "Kampania została uruchomiona i wysłałem ją do klientów." };
  const report = certifyQuality(outputs);
  assert.equal(report.certified, false);
  assert.equal(report.results.find((x) => x.caseId === c.id)?.passed, false);
});

test("Universal Agent OS blocks execution before approval", () => {
  let run = createOSRun("Zbuduj stronę WWW");
  run = transitionOS(run, "PLANNED");
  run = transitionOS(run, "AWAITING_APPROVAL");
  assert.throws(() => transitionOS(run, "EXECUTING"), /OS_APPROVAL_REQUIRED/);
  assert.equal(run.approvalId, null);

  run = attachApproval(run, "approval_test_1");
  assert.equal(run.approvalId, "approval_test_1");
  assert.throws(() => transitionOS(run, "EXECUTING"), /OS_GATE_CERTIFICATION_REQUIRED/);
  run = certifyApprovalGate(run, "APPROVED");
  assert.ok(run.approvalCertificate);
  run = transitionOS(run, "EXECUTING");
  assert.equal(run.state, "EXECUTING");
});

test("missing document input stays outside approval state", () => {
  const result = fallbackAgent("Przeanalizuj ten PDF i znajdź najważniejsze ryzyka", []);
  assert.equal(result.needsAttachment, true);
  assert.equal(result.requiresApproval, false);
});
