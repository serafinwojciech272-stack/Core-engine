import type { RecoveryExecutionAction } from "@/lib/recovery-executor";
import type { LearningSignal, VerificationOutcome } from "@/lib/m24-25-verification-contract";

export type LearningPromotionStatus = "PROMOTED" | "NO_PROMOTION";

export type RecoveryPolicyUpdate = {
  action: RecoveryExecutionAction;
  weightDelta: -1 | 0 | 1;
  confidenceBps: number;
  basis: "SUCCESS" | "PARTIAL" | "FAILED" | "UNVERIFIED";
};

export type RecoveryLearningPromotion = {
  tenantId: string;
  recoveryKey: string;
  executionId: string;
  action: RecoveryExecutionAction;
  outcome: VerificationOutcome;
  learningSignal: LearningSignal;
  status: LearningPromotionStatus;
  policyUpdate: RecoveryPolicyUpdate;
  learningVersion: number;
  promotionHash: string;
  promotedAt: string;
};
