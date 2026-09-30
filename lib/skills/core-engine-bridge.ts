import type { ExecutionLifecycleResult } from "./execution-lifecycle";
import { runMissionLearningLoop } from "@/lib/learning-loop";
import { getPersistedMissionSnapshot, recordPersistedMissionOutcome } from "@/lib/storage";

export type CoreEngineExecutionBridgeInput = {
  tenantId: string;
  missionId: string;
  lifecycle: ExecutionLifecycleResult;
  actionId?: string;
  predicted?: number;
  actual?: number;
  evidenceIds?: string[];
  domain?: string;
};

export type CoreEngineExecutionBridgeResult = {
  persisted: boolean;
  learningRun: Awaited<ReturnType<typeof runMissionLearningLoop>> | null;
  eventIds: string[];
  reason?: string;
};

function mergedEvidence(input: CoreEngineExecutionBridgeInput): string[] {
  return [...new Set([
    ...(input.evidenceIds ?? []),
    ...input.lifecycle.plan.evidenceIds,
    ...input.lifecycle.execution.evidenceIds,
    ...(input.lifecycle.verification?.evidenceIds ?? [])
  ])];
}

/**
 * Adapter only: the M11 lifecycle does not create a second mission/learning engine.
 * It projects a verified capability execution into the existing Core Engine trace,
 * then delegates learning to the existing M10 learning loop.
 */
export async function syncExecutionToCoreEngine(
  input: CoreEngineExecutionBridgeInput
): Promise<CoreEngineExecutionBridgeResult> {
  if (input.lifecycle.state !== "LEARNED" || !input.lifecycle.verification?.passed) {
    return {
      persisted: false,
      learningRun: null,
      eventIds: [],
      reason: "CORE_SYNC_REQUIRES_VERIFIED_LEARNED_LIFECYCLE"
    };
  }

  if (input.lifecycle.execution.status !== "EXECUTED") {
    return {
      persisted: false,
      learningRun: null,
      eventIds: [],
      reason: "CORE_SYNC_REQUIRES_EXECUTED_RESULT"
    };
  }

  const snapshot = await getPersistedMissionSnapshot(input.missionId);
  if (!snapshot.mission) throw new Error("MISSION_NOT_FOUND");

  const evidenceIds = mergedEvidence(input);
  const executionEvent = await recordPersistedMissionOutcome(
    input.missionId,
    "EXECUTION_RECORDED",
    {
      correlationId: input.lifecycle.execution.correlationId,
      actionId: input.actionId ?? input.lifecycle.plan.capabilityId,
      capabilityId: input.lifecycle.plan.capabilityId,
      skillId: input.lifecycle.plan.skillId,
      mode: input.lifecycle.plan.mode,
      executionId: input.lifecycle.execution.executionId,
      evidenceIds,
      source: "M11_EXECUTION_LIFECYCLE"
    }
  );

  const eventIds = executionEvent && typeof executionEvent === "object" && "id" in executionEvent
    ? [String((executionEvent as Record<string, unknown>).id)]
    : [];

  if (input.actual !== undefined || input.predicted !== undefined) {
    const measurementEvent = await recordPersistedMissionOutcome(
      input.missionId,
      "MEASUREMENT_RECORDED",
      {
        correlationId: input.lifecycle.execution.correlationId,
        predicted: input.predicted,
        actual: input.actual,
        evidenceIds,
        source: "M11_VERIFICATION_RESULT"
      }
    );
    if (measurementEvent && typeof measurementEvent === "object" && "id" in measurementEvent) {
      eventIds.push(String((measurementEvent as Record<string, unknown>).id));
    }
  }

  const learningRun = await runMissionLearningLoop({
    tenantId: input.tenantId,
    missionId: input.missionId,
    domain: input.domain
  });

  const learningEvent = await recordPersistedMissionOutcome(
    input.missionId,
    "LEARNING_RECORDED",
    {
      correlationId: input.lifecycle.execution.correlationId,
      source: "EXISTING_M10_LEARNING_LOOP",
      promoted: learningRun.promoted,
      resultCount: learningRun.results.length,
      evidenceIds,
      learningEventId: input.lifecycle.learning?.eventId
    }
  );
  if (learningEvent && typeof learningEvent === "object" && "id" in learningEvent) {
    eventIds.push(String((learningEvent as Record<string, unknown>).id));
  }

  return { persisted: true, learningRun, eventIds };
}
