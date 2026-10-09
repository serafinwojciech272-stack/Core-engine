import test from "node:test";
import assert from "node:assert/strict";
import {
  createProductionTask,
  getProductionTaskReadiness,
  transitionProductionTask
} from "@/lib/production-task-harness";

const now = "2026-10-09T09:00:00.000Z";
const criteria = [
  { id: "result-valid", description: "Final result is validated", required: true },
  { id: "artifact", description: "Expected artifact is present", required: true },
  { id: "optional-doc", description: "Optional documentation exists", required: false }
];

function task() {
  return createProductionTask({
    id: "task-test-001",
    title: "Controlled benchmark",
    objective: "Prove a task result using explicit acceptance criteria and evidence.",
    createdAt: now,
    acceptanceCriteria: criteria
  });
}

test("creates a queued task with pending acceptance criteria", () => {
  const record = task();
  assert.equal(record.schemaVersion, "production-task-v1");
  assert.equal(record.state, "QUEUED");
  assert.equal(record.score, null);
  assert.equal(record.criterionResults.every((item) => item.status === "PENDING"), true);
  assert.equal(getProductionTaskReadiness(record).readyToSucceed, false);
});

test("rejects missing acceptance criteria and duplicate criterion identifiers", () => {
  assert.throws(() => createProductionTask({
    id: "x", title: "Task", objective: "Objective", createdAt: now, acceptanceCriteria: []
  }), /ACCEPTANCE_CRITERIA_REQUIRED/);
  assert.throws(() => createProductionTask({
    id: "x", title: "Task", objective: "Objective", createdAt: now,
    acceptanceCriteria: [
      { id: "same", description: "One", required: true },
      { id: "same", description: "Two", required: true }
    ]
  }), /DUPLICATE_CRITERION_ID/);
});

test("prevents success without passing criteria, evidence, and a summary", () => {
  const record = transitionProductionTask(task(), { to: "ACCEPTED", at: now });
  const running = transitionProductionTask(record, { to: "RUNNING", at: now });
  const verifying = transitionProductionTask(running, { to: "VERIFYING", at: now });
  assert.throws(() => transitionProductionTask(verifying, {
    to: "SUCCEEDED", at: now, summary: "Looks good."
  }), /SUCCESS_REQUIRES_ALL_REQUIRED_CRITERIA/);
});

test("allows success only when required criteria point to recorded evidence", () => {
  const queued = task();
  const accepted = transitionProductionTask(queued, { to: "ACCEPTED", at: now });
  const running = transitionProductionTask(accepted, { to: "RUNNING", at: now });
  const verifying = transitionProductionTask(running, { to: "VERIFYING", at: now });
  const results = [
    { criterionId: "result-valid", status: "PASS" as const, evidenceRefs: ["test-1"] },
    { criterionId: "artifact", status: "PASS" as const, evidenceRefs: ["artifact-1"] },
    { criterionId: "optional-doc", status: "PENDING" as const, evidenceRefs: [] }
  ];
  assert.throws(() => transitionProductionTask(verifying, {
    to: "SUCCEEDED", at: now, summary: "Acceptance checks passed.", criterionResults: results
  }), /SUCCESS_REFERENCES_MISSING_EVIDENCE/);

  const succeeded = transitionProductionTask(verifying, {
    to: "SUCCEEDED",
    at: now,
    summary: "All required acceptance checks passed with recorded evidence.",
    criterionResults: results,
    evidence: [
      { id: "test-1", kind: "TEST", summary: "Acceptance test passed." },
      { id: "artifact-1", kind: "ARTIFACT", summary: "Artifact exists and was validated." }
    ],
    artifactRefs: ["artifact-1"]
  });
  assert.equal(succeeded.state, "SUCCEEDED");
  assert.equal(succeeded.score, 67);
  assert.equal(getProductionTaskReadiness(succeeded).readyToSucceed, true);
});

test("requires a failure code and makes terminal states immutable", () => {
  const accepted = transitionProductionTask(task(), { to: "ACCEPTED", at: now });
  assert.throws(() => transitionProductionTask(accepted, { to: "FAILED", at: now }), /FAILED_REQUIRES_FAILURE_CODE/);
  const failed = transitionProductionTask(accepted, {
    to: "FAILED", at: now, failureCode: "PROVIDER_UNAVAILABLE", summary: "Provider unavailable."
  });
  assert.throws(() => transitionProductionTask(failed, { to: "RUNNING", at: now }), /INVALID_TASK_TRANSITION/);
});
