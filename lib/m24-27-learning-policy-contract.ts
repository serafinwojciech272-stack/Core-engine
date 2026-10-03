import type { RecoveryExecutionAction } from "@/lib/recovery-executor";

export type RecoveryLearningPolicy = {
  tenantId: string;
  recoveryKey: string;
  action: RecoveryExecutionAction;
  sampleCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  unverifiedCount: number;
  netWeight: number;
  confidenceBps: number;
  policyVersion: number;
  source: "PROMOTED_LEARNING";
  aggregatedAt: string;
};