import type { RecoveryDecisionResult, RecoveryDecision } from "@/lib/recovery-decision-engine";
import type { RecoveryLearningPolicy } from "@/lib/m24-27-learning-policy-contract";

export type PolicyAwareRecoveryDecisionResult = Omit<RecoveryDecisionResult, "source"> & {
  policySource: "LEARNING_POLICY" | "NO_POLICY";
  selectedPolicy: RecoveryLearningPolicy | null;
  candidatePolicies: RecoveryLearningPolicy[];
  policyAdjusted: boolean;
  source: "RECOVERY_STATE + LEARNING_POLICY";
};

export type PolicyAwareRecoveryDecision = RecoveryDecision;
