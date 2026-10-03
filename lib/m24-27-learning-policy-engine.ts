import type { RecoveryExecutionAction } from "@/lib/recovery-executor";
import type { RecoveryLearningPromotion } from "@/lib/m24-26-learning-promotion-contract";
import type { RecoveryLearningPolicy } from "@/lib/m24-27-learning-policy-contract";

export function aggregateRecoveryLearningPolicy(
  tenantId: string,
  recoveryKey: string,
  promotions: RecoveryLearningPromotion[],
): RecoveryLearningPolicy[] {
  if (!tenantId || !recoveryKey) throw new Error("RECOVERY_LEARNING_POLICY_INPUT_INVALID");
  const scoped = promotions.filter(p => p.tenantId === tenantId && p.recoveryKey === recoveryKey);
  const actions: RecoveryExecutionAction[] = ["RESUME", "REPLAY", "RECONCILE"];
  return actions.map(action => {
    const rows = scoped.filter(p => p.action === action && p.status === "PROMOTED");
    const successCount = rows.filter(p => p.outcome === "SUCCESS").length;
    const partialCount = rows.filter(p => p.outcome === "PARTIAL").length;
    const failedCount = rows.filter(p => p.outcome === "FAILED").length;
    const unverifiedCount = scoped.filter(p => p.action === action && p.outcome === "UNVERIFIED").length;
    const netWeight = rows.reduce((sum, p) => sum + p.policyUpdate.weightDelta, 0);
    const confidenceBps = rows.length
      ? Math.round(rows.reduce((sum, p) => sum + p.policyUpdate.confidenceBps, 0) / rows.length)
      : 0;
    return {
      tenantId, recoveryKey, action,
      sampleCount: rows.length,
      successCount, partialCount, failedCount, unverifiedCount,
      netWeight, confidenceBps,
      policyVersion: rows.length,
      source: "PROMOTED_LEARNING" as const,
      aggregatedAt: new Date().toISOString(),
    };
  });
}

export type RecoveryLearningPolicyPort = {
  aggregate(tenantId: string, recoveryKey: string): Promise<RecoveryLearningPolicy[]>;
  read(tenantId: string, recoveryKey: string): Promise<RecoveryLearningPolicy[]>;
};