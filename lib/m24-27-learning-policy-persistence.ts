import type { RecoveryLearningPromotion } from "@/lib/m24-26-learning-promotion-contract";
import type { RecoveryLearningPolicy } from "@/lib/m24-27-learning-policy-contract";

type Rpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;

export class SupabaseRecoveryLearningPolicyPersistence {
  constructor(private readonly rpc: Rpc) {}
  async aggregate(tenantId: string, recoveryKey: string) {
    return await this.rpc("ce_recovery_learning_policy_aggregate", {
      p_tenant_id: tenantId, p_recovery_key: recoveryKey,
    }) as RecoveryLearningPolicy[];
  }
  async read(tenantId: string, recoveryKey: string) {
    return await this.rpc("ce_recovery_learning_policy_read", {
      p_tenant_id: tenantId, p_recovery_key: recoveryKey,
    }) as RecoveryLearningPolicy[];
  }
}

export function createSupabaseRecoveryLearningPolicyPersistence() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const rpc: Rpc = async (name, body) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method:"POST",
      headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
      body:JSON.stringify(body), cache:"no-store",
    });
    if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}`);
    return response.json();
  };
  return new SupabaseRecoveryLearningPolicyPersistence(rpc);
}

export type PromotionReader = {
  readAll(tenantId: string, recoveryKey: string): Promise<RecoveryLearningPromotion[]>;
};