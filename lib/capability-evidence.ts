import { createHash } from "node:crypto";
import type { Evidence } from "@/lib/core-contracts";
import type { CapabilityExecutionReceipt } from "@/lib/capability-action-registry";
import { assessOutcome, type OutcomeAssessment } from "@/lib/outcome-quality";

// M9.1 links a completed capability execution to the existing evidence and
// outcome infrastructure. It does not create a second measurement or learning
// engine: it produces evidence and outcome records that the existing layers
// consume, and every record identifies the execution it came from.

export type ExecutionEvidence = Evidence & {
  metadata: Record<string, unknown> & {
    sourceExecutionId: string;
    capabilityActionId: string;
    adapterId?: string;
    receiptStatus: string;
    sideEffectStatus: string;
  };
};

export type ExecutionOutcome = {
  missionId?: string;
  capabilityActionId: string;
  executionId: string;
  adapterId?: string;
  expected: { metric: string; value: number | null; direction: "higher" | "lower" };
  actual: { value: number | null };
  delta: number | null;
  deltaPct: number | null;
  assessment: OutcomeAssessment;
  timestamp: string;
};

function evidenceId(executionId: string, actionId: string) {
  return "ev_exec_" + createHash("sha256").update(`${executionId}\n${actionId}`).digest("hex").slice(0, 16);
}

function evidenceHash(receipt: CapabilityExecutionReceipt) {
  return createHash("sha256")
    .update([receipt.executionId, receipt.capabilityActionId, receipt.status, receipt.completedAt].join("\n"))
    .digest("hex");
}

// Only a successful execution produces evidence. A failed or blocked execution
// produces no positive evidence, so it can never be mistaken for a measured win.
export function buildExecutionEvidence(receipt: CapabilityExecutionReceipt): ExecutionEvidence | null {
  if (receipt.status !== "EXECUTED") return null;
  const claim = `Capability ${receipt.capabilityActionId} executed via adapter ${receipt.adapterId ?? "unknown"} (execution ${receipt.executionId}).`;
  return {
    id: evidenceId(receipt.executionId, receipt.capabilityActionId),
    claim,
    source: receipt.adapterId ?? "capability-adapter",
    supports: true,
    observedAt: receipt.completedAt,
    freshness: 1,
    reliability: receipt.observationalOnly ? 0.9 : 0.95,
    provenance: {
      sourceType: "capability-execution",
      sourceRegistered: true,
      hash: evidenceHash(receipt),
    },
    metadata: {
      sourceExecutionId: receipt.executionId,
      capabilityActionId: receipt.capabilityActionId,
      adapterId: receipt.adapterId,
      receiptStatus: receipt.status,
      sideEffectStatus: receipt.sideEffectStatus,
    },
  };
}

// The outcome carries the identity required for measurement: mission, capability
// action, execution, expected result, actual result, delta and timestamp. Delta
// and assessment reuse the existing outcome-quality infrastructure.
export function buildExecutionOutcome(input: {
  receipt: CapabilityExecutionReceipt;
  metric: string;
  direction?: "higher" | "lower";
  expected?: number | null;
  actual?: number | null;
}): ExecutionOutcome {
  const direction = input.direction === "lower" ? "lower" : "higher";
  const expected = typeof input.expected === "number" ? input.expected : null;
  const actual = typeof input.actual === "number" ? input.actual : null;
  const assessment = assessOutcome({
    before: expected ?? undefined,
    after: actual ?? undefined,
    direction,
  });
  return {
    missionId: input.receipt.missionId,
    capabilityActionId: input.receipt.capabilityActionId,
    executionId: input.receipt.executionId,
    adapterId: input.receipt.adapterId,
    expected: { metric: input.metric, value: expected, direction },
    actual: { value: actual },
    delta: assessment.delta,
    deltaPct: assessment.deltaPct,
    assessment,
    timestamp: input.receipt.completedAt,
  };
}

// A learning event is derived from an outcome; the existing learning engine
// consumes it. This only structures the input, it does not learn on its own.
export function buildExecutionLearningEvent(outcome: ExecutionOutcome) {
  return {
    missionId: outcome.missionId,
    executionId: outcome.executionId,
    capabilityActionId: outcome.capabilityActionId,
    outcomeQuality: outcome.assessment.quality,
    delta: outcome.delta,
    expected: outcome.expected,
    actual: outcome.actual,
    timestamp: outcome.timestamp,
  };
}
