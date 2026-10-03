import { createHash } from "node:crypto";
import type { RecoveryExecutionAction } from "@/lib/recovery-executor";
import type { RecoveryVerificationResult } from "@/lib/m24-25-verification-engine";
import type { RecoveryLearningPromotion, RecoveryPolicyUpdate } from "@/lib/m24-26-learning-promotion-contract";

export type LearningPromotionInput = RecoveryVerificationResult & {
  learningVersion?: number;
};

function policyUpdate(action: RecoveryExecutionAction, outcome: RecoveryVerificationResult["outcome"]): RecoveryPolicyUpdate {
  switch (outcome) {
    case "SUCCESS":
      return { action, weightDelta: 1, confidenceBps: 10000, basis: "SUCCESS" };
    case "PARTIAL":
      return { action, weightDelta: -1, confidenceBps: 5000, basis: "PARTIAL" };
    case "FAILED":
      return { action, weightDelta: -1, confidenceBps: 10000, basis: "FAILED" };
    case "UNVERIFIED":
      return { action, weightDelta: 0, confidenceBps: 0, basis: "UNVERIFIED" };
  }
}

export function promoteRecoveryLearning(input: LearningPromotionInput): RecoveryLearningPromotion {
  if (!input.tenantId || !input.recoveryKey || !input.executionId) {
    throw new Error("RECOVERY_LEARNING_PROMOTION_INPUT_INVALID");
  }

  const update = policyUpdate(input.action, input.outcome);
  const status = input.outcome === "UNVERIFIED" ? "NO_PROMOTION" : "PROMOTED";
  const learningVersion = input.learningVersion && input.learningVersion > 0
    ? Math.floor(input.learningVersion)
    : 1;

  const promotionHash = createHash("sha256").update(JSON.stringify({
    tenantId: input.tenantId,
    recoveryKey: input.recoveryKey,
    executionId: input.executionId,
    action: input.action,
    outcome: input.outcome,
    learningSignal: input.learningSignal,
    status,
    policyUpdate: update,
    learningVersion,
  })).digest("hex");

  return {
    tenantId: input.tenantId,
    recoveryKey: input.recoveryKey,
    executionId: input.executionId,
    action: input.action,
    outcome: input.outcome,
    learningSignal: input.learningSignal,
    status,
    policyUpdate: update,
    learningVersion,
    promotionHash,
    promotedAt: new Date().toISOString(),
  };
}

export type RecoveryLearningPromotionPort = {
  promote(input: RecoveryLearningPromotion): Promise<unknown>;
  read(tenantId: string, recoveryKey: string): Promise<RecoveryLearningPromotion | null>;
};

export async function promoteAndPersistRecoveryLearning(
  input: LearningPromotionInput,
  port: RecoveryLearningPromotionPort,
): Promise<RecoveryLearningPromotion> {
  const promotion = promoteRecoveryLearning(input);
  await port.promote(promotion);
  return promotion;
}
