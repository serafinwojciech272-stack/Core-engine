import test from "node:test";
import assert from "node:assert/strict";
import { buildExecutionEvidence, buildExecutionOutcome, buildExecutionLearningEvent } from "@/lib/capability-evidence";
import type { CapabilityExecutionReceipt } from "@/lib/capability-action-registry";

function receipt(overrides: Partial<CapabilityExecutionReceipt> = {}): CapabilityExecutionReceipt {
  return {
    executionId: "exec-1",
    missionId: "mission-1",
    capabilityActionId: "analytics.report",
    adapterId: "core.web-audit.v1",
    status: "EXECUTED",
    attempt: 1,
    startedAt: "2026-09-26T00:00:00.000Z",
    completedAt: "2026-09-26T00:00:01.000Z",
    sideEffect: false,
    sideEffectStatus: "NONE",
    retryable: false,
    observationalOnly: true,
    ...overrides,
  } as CapabilityExecutionReceipt;
}

test("M9.1 a successful execution produces evidence that identifies its source execution", () => {
  const evidence = buildExecutionEvidence(receipt());
  assert.ok(evidence);
  assert.equal(evidence.metadata.sourceExecutionId, "exec-1");
  assert.equal(evidence.metadata.capabilityActionId, "analytics.report");
  assert.equal(evidence.metadata.adapterId, "core.web-audit.v1");
  assert.equal(evidence.source, "core.web-audit.v1");
  assert.equal(evidence.observedAt, "2026-09-26T00:00:01.000Z");
  assert.match(evidence.id, /^ev_exec_[a-f0-9]{16}$/);
});

test("M9.1 a failed execution produces no positive evidence", () => {
  assert.equal(buildExecutionEvidence(receipt({ status: "FAILED" })), null);
  assert.equal(buildExecutionEvidence(receipt({ status: "BLOCKED" })), null);
  assert.equal(buildExecutionEvidence(receipt({ status: "ADAPTER_NOT_FOUND" })), null);
});

test("M9.1 evidence is deterministic for the same execution", () => {
  assert.deepEqual(buildExecutionEvidence(receipt()), buildExecutionEvidence(receipt()));
});

test("M9.1 outcome identifies mission, capability/action, execution, expected, actual, delta and timestamp", () => {
  const outcome = buildExecutionOutcome({ receipt: receipt(), metric: "conversion_rate", direction: "higher", expected: 2.0, actual: 2.4 });
  assert.equal(outcome.missionId, "mission-1");
  assert.equal(outcome.capabilityActionId, "analytics.report");
  assert.equal(outcome.executionId, "exec-1");
  assert.equal(outcome.adapterId, "core.web-audit.v1");
  assert.deepEqual(outcome.expected, { metric: "conversion_rate", value: 2.0, direction: "higher" });
  assert.deepEqual(outcome.actual, { value: 2.4 });
  assert.equal(Number(outcome.delta!.toFixed(4)), 0.4);
  assert.equal(outcome.assessment.quality, "VERIFIED");
  assert.equal(outcome.timestamp, "2026-09-26T00:00:01.000Z");
});

test("M9.1 outcome reuses the existing outcome-quality assessment for a negative result", () => {
  const outcome = buildExecutionOutcome({ receipt: receipt(), metric: "cost_per_lead", direction: "lower", expected: 10, actual: 14 });
  assert.equal(outcome.assessment.quality, "NEGATIVE");
  assert.equal(outcome.assessment.improved, false);
});

test("M9.1 learning event is derived from the outcome and reuses its quality", () => {
  const outcome = buildExecutionOutcome({ receipt: receipt(), metric: "conversion_rate", direction: "higher", expected: 2.0, actual: 2.4 });
  const lesson = buildExecutionLearningEvent(outcome);
  assert.equal(lesson.missionId, "mission-1");
  assert.equal(lesson.executionId, "exec-1");
  assert.equal(lesson.capabilityActionId, "analytics.report");
  assert.equal(lesson.outcomeQuality, "VERIFIED");
  assert.equal(lesson.delta, outcome.delta);
});

test("M9.1 a missing actual value is unverified rather than a fabricated win", () => {
  const outcome = buildExecutionOutcome({ receipt: receipt(), metric: "conversion_rate", direction: "higher", expected: 2.0 });
  assert.equal(outcome.assessment.quality, "UNVERIFIED");
  assert.equal(outcome.delta, null);
  assert.equal(outcome.actual.value, null);
});
