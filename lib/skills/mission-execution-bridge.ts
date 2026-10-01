import type { CapabilityAction } from "@/lib/capability-contracts";
import { executeCapabilityAction, type CapabilityExecutionReceipt } from "@/lib/capability-action-registry";
import { runExecutionLifecycle, type ExecutionLifecycleResult } from "@/lib/skills/execution-lifecycle";
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
};

function skillForCapability(action: SkillMissionExecutionInput["action"]): SkillDefinition {
  const riskLevel = action.risk;
  return {
    id: `capability.${action.id}`,
    version: "1.0.0",
    name: action.name,
    description: action.description,
    domain: action.packId ?? "core",
    capabilities: [{
      id: action.id,
      description: action.description,
      riskLevel,
      modes: ["SIMULATION", "SHADOW", "LIVE"],
      requiredTools: ["tool-registry"]
    }],
    policies: [
      "Capability execution is governed by the Core Engine mission approval state.",
      "Existing capability adapter permissions and idempotency remain authoritative.",
      "No execution occurs when policy, approval, risk or adapter gates reject the request."
    ],
    verification: ["adapter-receipt"],
    learningPolicy: "Execution outcomes are measured and learned by the existing Core Engine lifecycle."
  };
}

export async function executeSkillMissionCapability(
  input: SkillMissionExecutionInput
): Promise<SkillMissionExecutionResult> {
  const skill = skillForCapability(input.action);
  const context: SkillExecutionContext = {
    tenantId: input.tenantId,
    missionId: input.missionId,
    mode: "LIVE",
    approvalRequired: input.action.requiresApproval,
    correlationId: `mission:${input.missionId}:capability:${input.action.id}:${input.idempotencyKey}`
  };

  let receipt: CapabilityExecutionReceipt | undefined;
  const lifecycle = runExecutionLifecycle({
    skill,
    capabilityId: input.action.id,
    context,
    approved: input.approved,
    approvedBy: input.approvedBy,
    evidenceIds: input.evidenceIds,
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
      verificationId: `verification:${execution.executionId}`,
      correlationId: context.correlationId,
      passed: Boolean(receipt && receipt.status === "EXECUTED"),
      checks: [
        "CAPABILITY_RECEIPT_PRESENT",
        "CAPABILITY_EXECUTION_STATUS_EXECUTED",
        "CAPABILITY_ADAPTER_BOUNDARY_ACCEPTED"
      ],
      evidenceIds: input.evidenceIds ?? []
    })
  });

  if (!receipt) {
    throw new Error("CAPABILITY_EXECUTION_RECEIPT_MISSING");
  }

  return { lifecycle, receipt };
}
