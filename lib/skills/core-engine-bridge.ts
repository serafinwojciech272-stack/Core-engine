import type { ExecutionLifecycleResult } from "./execution-lifecycle";
import { runMissionLearningLoop } from "@/lib/learning-loop";
import {
  getPersistedMissionSnapshot,
  recordPersistedMissionOutcome,
  transitionPersistedMission,
  claimPersistedMissionLearning
} from "@/lib/storage";
import { assertGovernedMissionPhase } from "@/lib/skills/mission-state-gate";

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
 * Adapter only. The persisted Core Engine mission state is authoritative:
 * EXECUTING -> MEASURING -> COMPLETED -> LEARNED.
 * M11 verifies execution; M10 remains the sole learning engine.
 */
export async function syncExecutionToCoreEngine(
  input: CoreEngineExecutionBridgeInput
): Promise<CoreEngineExecutionBridgeResult> {
  if (input.lifecycle.state !== "VERIFIED" || !input.lifecycle.verification?.passed) {
    return {
      persisted: false,
      learningRun: null,
      eventIds: [],
      reason: "CORE_SYNC_REQUIRES_VERIFIED_LIFECYCLE"
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

  assertGovernedMissionPhase(snapshot.mission.state, "LEARNING");

  const evidenceIds = mergedEvidence(input);
  if (evidenceIds.length === 0) {
    return { persisted: false, learningRun: null, eventIds: [], reason: "CORE_LEARNING_EVIDENCE_REQUIRED" };
  }
  const eventIds: string[] = [];
  const learningKey = `learning:${input.lifecycle.execution.correlationId}`;
  const claim = await claimPersistedMissionLearning(input.missionId, learningKey);

  if (!claim.claimed) {
    return {
      persisted: false,
      learningRun: null,
      eventIds: [],
      reason: `CORE_LEARNING_GATE_BLOCKED:${claim.claim_mode}`
    };
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
      actionId: input.actionId ?? input.lifecycle.plan.capabilityId,
      capabilityId: input.lifecycle.plan.capabilityId,
      skillId: input.lifecycle.plan.skillId,
      source: "EXISTING_M10_LEARNING_LOOP",
      promoted: learningRun.promoted,
      resultCount: learningRun.results.length,
      evidenceIds
    }
  );

  if (learningEvent && typeof learningEvent === "object" && "id" in learningEvent) {
    eventIds.push(String((learningEvent as Record<string, unknown>).id));
  }

  await transitionPersistedMission(input.missionId, "LEARNED", "system");
  return { persisted: true, learningRun, eventIds };
}
