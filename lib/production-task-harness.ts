export type ProductionTaskState =
  | "QUEUED"
  | "ACCEPTED"
  | "RUNNING"
  | "VERIFYING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED"
  | "BLOCKED";

export type AcceptanceStatus = "PENDING" | "PASS" | "FAIL" | "BLOCKED";

export type AcceptanceCriterion = {
  id: string;
  description: string;
  required: boolean;
};

export type CriterionResult = {
  criterionId: string;
  status: AcceptanceStatus;
  evidenceRefs: string[];
  note?: string;
};

export type TaskEvidence = {
  id: string;
  kind: "LOG" | "TEST" | "ARTIFACT" | "SOURCE" | "API_RESPONSE" | "HUMAN_REVIEW";
  summary: string;
  uri?: string;
  sha256?: string;
};

export type ProductionTaskRecord = {
  schemaVersion: "production-task-v1";
  id: string;
  title: string;
  objective: string;
  state: ProductionTaskState;
  createdAt: string;
  updatedAt: string;
  acceptanceCriteria: AcceptanceCriterion[];
  criterionResults: CriterionResult[];
  evidence: TaskEvidence[];
  artifactRefs: string[];
  outcomeSummary?: string;
  failureCode?: string;
  score: number | null;
};

export type CreateProductionTaskInput = {
  id: string;
  title: string;
  objective: string;
  createdAt: string;
  acceptanceCriteria: AcceptanceCriterion[];
};

const transitions: Record<ProductionTaskState, readonly ProductionTaskState[]> = {
  QUEUED: ["ACCEPTED", "BLOCKED", "FAILED"],
  ACCEPTED: ["RUNNING", "BLOCKED", "FAILED"],
  RUNNING: ["VERIFYING", "PARTIAL", "BLOCKED", "FAILED"],
  VERIFYING: ["RUNNING", "SUCCEEDED", "PARTIAL", "BLOCKED", "FAILED"],
  SUCCEEDED: [],
  PARTIAL: [],
  FAILED: [],
  BLOCKED: []
};

function nonEmpty(value: string) {
  return value.trim().length > 0;
}

function assertTimestamp(value: string, field: string) {
  if (!nonEmpty(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("INVALID_" + field.toUpperCase());
  }
}

export function createProductionTask(input: CreateProductionTaskInput): ProductionTaskRecord {
  if (!nonEmpty(input.id)) throw new Error("TASK_ID_REQUIRED");
  if (!nonEmpty(input.title)) throw new Error("TASK_TITLE_REQUIRED");
  if (!nonEmpty(input.objective)) throw new Error("TASK_OBJECTIVE_REQUIRED");
  assertTimestamp(input.createdAt, "created_at");
  if (!Array.isArray(input.acceptanceCriteria) || input.acceptanceCriteria.length === 0) {
    throw new Error("ACCEPTANCE_CRITERIA_REQUIRED");
  }

  const seen = new Set<string>();
  const criteria = input.acceptanceCriteria.map((criterion) => {
    if (!nonEmpty(criterion.id) || !nonEmpty(criterion.description)) {
      throw new Error("INVALID_ACCEPTANCE_CRITERION");
    }
    if (seen.has(criterion.id)) throw new Error("DUPLICATE_CRITERION_ID");
    seen.add(criterion.id);
    return { id: criterion.id, description: criterion.description.trim(), required: criterion.required !== false };
  });

  return {
    schemaVersion: "production-task-v1",
    id: input.id.trim(),
    title: input.title.trim(),
    objective: input.objective.trim(),
    state: "QUEUED",
    createdAt: new Date(input.createdAt).toISOString(),
    updatedAt: new Date(input.createdAt).toISOString(),
    acceptanceCriteria: criteria,
    criterionResults: criteria.map((criterion) => ({
      criterionId: criterion.id,
      status: "PENDING",
      evidenceRefs: []
    })),
    evidence: [],
    artifactRefs: [],
    outcomeSummary: undefined,
    failureCode: undefined,
    score: null
  };
}

export type TaskTransitionInput = {
  to: ProductionTaskState;
  at: string;
  summary?: string;
  failureCode?: string;
  criterionResults?: CriterionResult[];
  evidence?: TaskEvidence[];
  artifactRefs?: string[];
};

export function transitionProductionTask(
  task: ProductionTaskRecord,
  input: TaskTransitionInput
): ProductionTaskRecord {
  assertTimestamp(input.at, "transition_timestamp");
  if (!transitions[task.state].includes(input.to)) {
    throw new Error("INVALID_TASK_TRANSITION:" + task.state + "->" + input.to);
  }

  const criterionResults = input.criterionResults ?? task.criterionResults;
  const evidence = [...task.evidence, ...(input.evidence ?? [])];
  const artifactRefs = [...new Set([...task.artifactRefs, ...(input.artifactRefs ?? [])])];

  const criterionIds = new Set(task.acceptanceCriteria.map((criterion) => criterion.id));
  const resultIds = new Set<string>();
  for (const result of criterionResults) {
    if (!criterionIds.has(result.criterionId)) throw new Error("UNKNOWN_CRITERION_RESULT");
    if (resultIds.has(result.criterionId)) throw new Error("DUPLICATE_CRITERION_RESULT");
    resultIds.add(result.criterionId);
    if (!Array.isArray(result.evidenceRefs) || result.evidenceRefs.some((ref) => !nonEmpty(ref))) {
      throw new Error("INVALID_CRITERION_EVIDENCE");
    }
  }

  const allRequiredPassed = task.acceptanceCriteria
    .filter((criterion) => criterion.required)
    .every((criterion) => criterionResults.some((result) => result.criterionId === criterion.id && result.status === "PASS"));
  const allRequiredHaveEvidence = task.acceptanceCriteria
    .filter((criterion) => criterion.required)
    .every((criterion) => {
      const result = criterionResults.find((item) => item.criterionId === criterion.id);
      return Boolean(result && result.status === "PASS" && result.evidenceRefs.length > 0);
    });

  if (input.to === "SUCCEEDED") {
    if (!allRequiredPassed) throw new Error("SUCCESS_REQUIRES_ALL_REQUIRED_CRITERIA");
    if (!allRequiredHaveEvidence) throw new Error("SUCCESS_REQUIRES_CRITERION_EVIDENCE");
    const referencedEvidence = new Set(evidence.map((item) => item.id));
    const dangling = criterionResults
      .filter((result) => result.status === "PASS")
      .flatMap((result) => result.evidenceRefs)
      .filter((ref) => !referencedEvidence.has(ref));
    if (dangling.length) throw new Error("SUCCESS_REFERENCES_MISSING_EVIDENCE");
    if (!nonEmpty(input.summary ?? "")) throw new Error("SUCCESS_REQUIRES_OUTCOME_SUMMARY");
  }

  if (input.to === "FAILED" && !nonEmpty(input.failureCode ?? "")) {
    throw new Error("FAILED_REQUIRES_FAILURE_CODE");
  }
  if (input.to === "BLOCKED" && !nonEmpty(input.summary ?? "")) {
    throw new Error("BLOCKED_REQUIRES_REASON");
  }

  const passed = criterionResults.filter((result) => result.status === "PASS").length;
  const score = criterionResults.length === 0 ? 0 : Math.round((passed / task.acceptanceCriteria.length) * 100);

  return {
    ...task,
    state: input.to,
    updatedAt: new Date(input.at).toISOString(),
    criterionResults: criterionResults.map((result) => ({
      ...result,
      evidenceRefs: [...result.evidenceRefs]
    })),
    evidence,
    artifactRefs,
    outcomeSummary: input.summary ?? task.outcomeSummary,
    failureCode: input.failureCode ?? task.failureCode,
    score: ["SUCCEEDED", "PARTIAL", "FAILED", "BLOCKED"].includes(input.to) ? score : task.score
  };
}

export function getProductionTaskReadiness(task: ProductionTaskRecord) {
  const required = task.acceptanceCriteria.filter((criterion) => criterion.required);
  const passedRequired = required.filter((criterion) =>
    task.criterionResults.some((result) =>
      result.criterionId === criterion.id &&
      result.status === "PASS" &&
      result.evidenceRefs.length > 0 &&
      result.evidenceRefs.every((ref) => task.evidence.some((item) => item.id === ref))
    )
  );
  const requiredPending = required.filter((criterion) =>
    !task.criterionResults.some((result) => result.criterionId === criterion.id && result.status === "PASS")
  ).map((criterion) => criterion.id);

  return {
    readyToSucceed: required.length > 0 && passedRequired.length === required.length,
    requiredCriteria: required.length,
    passedRequiredCriteria: passedRequired.length,
    requiredPending,
    evidenceCount: task.evidence.length,
    artifactCount: task.artifactRefs.length
  };
}
