import type { RecoveryLearningPromotion } from "@/lib/m24-26-learning-promotion-contract";

type Rpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;

export class SupabaseRecoveryLearningPromotionPersistence {
  constructor(private readonly rpc: Rpc) {}

  async promote(input: RecoveryLearningPromotion) {
    return await this.rpc("ce_recovery_learning_promotion_commit", {
      p_tenant_id: input.tenantId,
      p_recovery_key: input.recoveryKey,
      p_execution_id: input.executionId,
      p_action: input.action,
      p_outcome: input.outcome,
      p_learning_signal: input.learningSignal,
      p_status: input.status,
      p_weight_delta: input.policyUpdate.weightDelta,
      p_confidence_bps: input.policyUpdate.confidenceBps,
      p_basis: input.policyUpdate.basis,
      p_learning_version: input.learningVersion,
      p_promotion_hash: input.promotionHash,
      p_promoted_at: input.promotedAt,
    });
  }

  async read(tenantId: string, recoveryKey: string) {
    return await this.rpc("ce_recovery_learning_promotion_read", {
      p_tenant_id: tenantId,
      p_recovery_key: recoveryKey,
    }) as RecoveryLearningPromotion | null;
  }
}

export function createSupabaseRecoveryLearningPromotionPersistence() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");

  const rpc: Rpc = async (name, body) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}`);
    return response.json();
  };

  return new SupabaseRecoveryLearningPromotionPersistence(rpc);
}
