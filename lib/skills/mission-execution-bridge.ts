import type { CapabilityAction } from "@/lib/capability-contracts";
import { executeCapabilityAction, type CapabilityExecutionReceipt } from "@/lib/capability-action-registry";
import {
  getPersistedMissionSnapshot,
  claimAndStartPersistedMission,
  transitionPersistedMission,
  recordPersistedMissionOutcome,
  recordMeasurementAndCompletePersistedMission
} from "@/lib/storage";
import { runExecutionLifecycle, type ExecutionLifecycleResult } from "@/lib/skills/execution-lifecycle";
import { assertGovernedMissionPhase } from "@/lib/skills/mission-state-gate";
import type { SkillDefinition, SkillExecutionContext } from "@/lib/skills/types";

export type SkillMissionExecutionInput = {
  action: CapabilityAction & { packId?: string };
  missionId: string;
  tenantId: string;
  idempotencyKey: string;
  approved: boolean;
  approvedBy?: string;
  input?: Record<string, unknown>;
  evidenceIds?: string[];
};

export type SkillMissionExecutionResult = {
  lifecycle: ExecutionLifecycleResult;
  receipt: CapabilityExecutionReceipt;
  missionState: "MEASURING" | "FAILED";
  persistedEventIds: string[];
};

export type SkillMissionMeasurementInput = {
  missionId: string;
  correlationId: string;
  predicted: number;
  actual: number;
  evidenceIds?: string[];
};

export type SkillMissionMeasurementResult = {
  missionState: "COMPLETED";
  eventIds: string[];
};

function skillForCapability(action: SkillMissionExecutionInput["action"]): SkillDefinition {
  return {
    id: "capability." + action.id,
    version: "1.0.0",
    name: action.name,
    description: action.description,
    domain: action.packId ?? "core",
    capabilities: [{
      id: action.id,
      description: action.description,
      riskLevel: action.risk,
      modes: ["SIMULATION", "SHADOW", "LIVE"],
      requiredTools: ["tool-registry"]
    }],
    policies: [
      "Capability execution is governed by the persisted Core Engine mission state.",
      "Execution requires the mission to be APPROVED before the side-effect boundary.",
      "Existing capability adapter permissions and idempotency remain authoritative."
    ],
    verification: ["adapter-receipt", "persisted-mission-state"],
    learningPolicy: "Measurement and learning are completed by the existing Core Engine lifecycle."
  };
}

export async function executeSkillMissionCapability(
  input: SkillMissionExecutionInput
): Promise<SkillMissionExecutionResult> {
  const snapshot = await getPersistedMissionSnapshot(input.missionId);
  if (!snapshot.mission) throw new Error("MISSION_NOT_FOUND");
  assertGovernedMissionPhase(snapshot.mission.state, "EXECUTION");

  const executionGate = await claimAndStartPersistedMission(
    input.missionId,
    "capability-execute:" + input.action.id,
    input.idempotencyKey
  );
  if (!executionGate.started) {
    if (executionGate.claim_mode === "IDEMPOTENCY_REPLAY") {
      throw new Error("CAPABILITY_EXECUTION_IDEMPOTENCY_CLAIMED");
    }
    throw new Error("MISSION_EXECUTION_GATE_BLOCKED:" + executionGate.claim_mode);
  }

  const skill = skillForCapability(input.action);
  const context: SkillExecutionContext = {
    tenantId: input.tenantId,
    missionId: input.missionId,
    mode: "LIVE",
    approvalRequired: input.action.requiresApproval,
    correlationId: "mission:" + input.missionId + ":capability:" + input.action.id + ":" + input.idempotencyKey
  };

  let receipt: CapabilityExecutionReceipt | undefined;
  const lifecycle = await runExecutionLifecycle({
    skill,
    capabilityId: input.action.id,
    context,
    approved: input.approved,
    approvedBy: input.approvedBy,
    evidenceIds: input.evidenceIds,
    deferLearning: true,
    execute: async () => {
      receipt = await executeCapabilityAction({
        actionId: input.action.id,
        approved: input.approved,
        missionId: input.missionId,
        idempotencyKey: input.idempotencyKey,
        input: input.input
      });
      return {
        executionId: receipt.executionId,
        correlationId: context.correlationId,
        status: receipt.status === "EXECUTED" ? "EXECUTED" : "FAILED",
        sideEffect: receipt.sideEffect,
        evidenceIds: input.evidenceIds ?? [],
        output: receipt.output
      };
    },
    verify: (execution) => ({
      verificationId: "verification:" + execution.executionId,
      correlationId: context.correlationId,
      passed: Boolean(receipt && receipt.status === "EXECUTED"),
      checks: [
        "CAPABILITY_RECEIPT_PRESENT",
        "CAPABILITY_EXECUTION_STATUS_EXECUTED",
        "CAPABILITY_ADAPTER_BOUNDARY_ACCEPTED",
        "PERSISTED_MISSION_STATE_EXECUTING"
      ],
      evidenceIds: input.evidenceIds ?? []
    })
  });

  if (!receipt) throw new Error("CAPABILITY_EXECUTION_RECEIPT_MISSING");

  const evidenceIds = [...new Set([
    ...(input.evidenceIds ?? []),
    ...lifecycle.plan.evidenceIds,
    ...lifecycle.execution.evidenceIds,
    ...(lifecycle.verification?.evidenceIds ?? [])
  ])];

  if (
    lifecycle.state !== "VERIFIED" ||
    !lifecycle.verification?.passed ||
    lifecycle.execution.status !== "EXECUTED" ||
    receipt.status !== "EXECUTED"
  ) {
    await transitionPersistedMission(input.missionId, "FAILED", "system");
    return { lifecycle, receipt, missionState: "FAILED", persistedEventIds: [] };
  }

  const executionEvent = await recordPersistedMissionOutcome(
    input.missionId,
    "EXECUTION_RECORDED",
    {
      correlationId: context.correlationId,
      actionId: input.action.id,
      capabilityId: input.action.id,
      skillId: skill.id,
      mode: context.mode,
      executionId: receipt.executionId,
      evidenceIds,
      source: "M11_EXECUTION_LIFECYCLE"
    }
  );

  const eventIds = executionEvent && typeof executionEvent === "object" && "id" in executionEvent
    ? [String((executionEvent as Record<string, unknown>).id)]
    : [];

  await transitionPersistedMission(input.missionId, "MEASURING", "system");
  return { lifecycle, receipt, missionState: "MEASURING", persistedEventIds: eventIds };
}

export async function completeSkillMissionMeasurement(
  input: SkillMissionMeasurementInput
): Promise<SkillMissionMeasurementResult> {
  const snapshot = await getPersistedMissionSnapshot(input.missionId);
  if (!snapshot.mission) throw new Error("MISSION_NOT_FOUND");
  assertGovernedMissionPhase(snapshot.mission.state, "MEASUREMENT");

  if (!Number.isFinite(input.predicted) || !Number.isFinite(input.actual)) {
    throw new Error("MEASUREMENT_VALUES_REQUIRED");
  }

  const result = await recordMeasurementAndCompletePersistedMission(
    input.missionId,
    input.correlationId,
    input.predicted,
    input.actual,
    input.evidenceIds ?? []
  );

  if (!result.completed) {
    throw new Error("MISSION_MEASUREMENT_GATE_BLOCKED:" + result.result_mode);
  }

  return {
    missionState: "COMPLETED",
    eventIds: result.event_id ? [result.event_id] : []
  };
}
