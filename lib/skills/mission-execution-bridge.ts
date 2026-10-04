import type { CapabilityAction } from "@/lib/capability-contracts";
import { executeCapabilityAction, type CapabilityExecutionReceipt } from "@/lib/capability-action-registry";
import {
  getPersistedMissionSnapshot,
  claimAndStartPersistedMission,
  failPersistedMission,
  recordExecutionAndEnterMeasurement,
  recordMeasurementAndCompletePersistedMission
} from "@/lib/storage";
import { enforcePersistentAgentExecution, closePersistentAgentExecution, verifyPersistentAgentExecutionConsumption } from "@/lib/skills/agent-execution-enforcement";
import { runExecutionLifecycle, type ExecutionLifecycleResult } from "@/lib/skills/execution-lifecycle";
import { assertGovernedMissionPhase } from "@/lib/skills/mission-state-gate";
import type { SkillDefinition, SkillExecutionContext } from "@/lib/skills/types";
import type { MissionState } from "@/lib/engine";

export type SkillMissionExecutionInput = {
  action: CapabilityAction & { packId?: string };
  missionId: string;
  tenantId: string;
  idempotencyKey: string;
  approved: boolean;
  approvedBy?: string;
  input?: Record<string, unknown>;
  evidenceIds?: string[];
  compositionId?: string;
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
      "Capability execution is governed by persistent agent authorization and mission state.",
      "Execution requires an exact approved capability scope before the side-effect boundary.",
      "Existing capability adapter permissions and idempotency remain authoritative."
    ],
    verification: ["adapter-receipt", "persistent-authorization", "persisted-mission-state"],
    learningPolicy: "Measurement and learning are completed by the existing Core Engine lifecycle."
  };
}

export async function executeSkillMissionCapability(
  input: SkillMissionExecutionInput
): Promise<SkillMissionExecutionResult> {
  const snapshot = await getPersistedMissionSnapshot(input.missionId);
  if (!snapshot.mission) throw new Error("MISSION_NOT_FOUND");
  assertGovernedMissionPhase(snapshot.mission.state as MissionState, "EXECUTION");

  const skill = skillForCapability(input.action);
  const correlationId = "mission:" + input.missionId + ":capability:" + input.action.id + ":" + input.idempotencyKey;

  if (!input.compositionId) {
    throw new Error("PERSISTENT_COMPOSITION_REQUIRED");
  }

  const authorization = await enforcePersistentAgentExecution({
    compositionId: input.compositionId,
    tenantId: input.tenantId,
    missionId: input.missionId,
    capabilityId: input.action.id,
    correlationId,
    skillId: skill.id,
    skillVersion: skill.version,
    mode: "LIVE"
  });

  if (!authorization.allowed || !authorization.authorizationId) {
    throw new Error("EXECUTOR_AUTHORIZATION_BLOCKED:" + authorization.reason);
  }

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

  const context: SkillExecutionContext = {
    tenantId: input.tenantId,
    missionId: input.missionId,
    mode: "LIVE",
    approvalRequired: input.action.requiresApproval,
    correlationId
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
        "PERSISTENT_AUTHORIZATION_ACTIVE",
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
    const failureCode =
      receipt.status !== "EXECUTED"
        ? "CAPABILITY_EXECUTION_FAILED"
        : lifecycle.verification?.passed === false
          ? "VERIFICATION_FAILED"
          : "EXECUTION_LIFECYCLE_REJECTED";

    await closePersistentAgentExecution({
      compositionId: input.compositionId,
      authorizationId: authorization.authorizationId,
      success: false,
      reason: failureCode
    });

    const failure = await failPersistedMission(
      input.missionId,
      failureCode,
      failureCode === "CAPABILITY_EXECUTION_FAILED",
      {
        correlationId: context.correlationId,
        actionId: input.action.id,
        executionId: receipt.executionId,
        authorizationId: authorization.authorizationId,
        evidenceIds
      }
    );

    const consumption = await verifyPersistentAgentExecutionConsumption({
      compositionId: input.compositionId,
      authorizationId: authorization.authorizationId,
      tenantId: input.tenantId,
      missionId: input.missionId,
      capabilityId: input.action.id,
      correlationId,
      skillId: skill.id,
      skillVersion: skill.version,
      mode: "LIVE",
      expectedResult: "FAILURE"
    });
    if (!consumption.verified) throw new Error("EXECUTOR_CONSUMPTION_VERIFICATION_FAILED:" + consumption.reason);

    return { lifecycle, receipt, missionState: "FAILED", persistedEventIds: failure.event_id ? [failure.event_id] : [] };
  }

  await closePersistentAgentExecution({
    compositionId: input.compositionId,
    authorizationId: authorization.authorizationId,
    success: true,
    reason: "VERIFIED_EXECUTION"
  });

  const consumption = await verifyPersistentAgentExecutionConsumption({
    compositionId: input.compositionId,
    authorizationId: authorization.authorizationId,
    tenantId: input.tenantId,
    missionId: input.missionId,
    capabilityId: input.action.id,
    correlationId,
    skillId: skill.id,
    skillVersion: skill.version,
    mode: "LIVE",
    expectedResult: "SUCCESS"
  });
  if (!consumption.verified) throw new Error("EXECUTOR_CONSUMPTION_VERIFICATION_FAILED:" + consumption.reason);

  const measurementGate = await recordExecutionAndEnterMeasurement(
    input.missionId,
    context.correlationId,
    input.action.id,
    receipt.executionId,
    evidenceIds
  );

  if (!measurementGate.advanced) {
    throw new Error("MISSION_EXECUTION_COMPLETION_GATE_BLOCKED:" + measurementGate.result_mode);
  }

  return {
    lifecycle,
    receipt,
    missionState: "MEASURING",
    persistedEventIds: measurementGate.event_id ? [measurementGate.event_id] : []
  };
}

export async function completeSkillMissionMeasurement(
  input: SkillMissionMeasurementInput
): Promise<SkillMissionMeasurementResult> {
  const snapshot = await getPersistedMissionSnapshot(input.missionId);
  if (!snapshot.mission) throw new Error("MISSION_NOT_FOUND");
  assertGovernedMissionPhase(snapshot.mission.state as MissionState, "MEASUREMENT");

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
