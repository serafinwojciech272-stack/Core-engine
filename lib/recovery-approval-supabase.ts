import type { RecoveryApprovalPort, RecoveryApprovalRequest, RecoveryApprovalResult } from "@/lib/recovery-approval-gate";
import { hashRecoveryDecision } from "@/lib/recovery-approval-gate";

type Rpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;

export class SupabaseRecoveryApprovalGate implements RecoveryApprovalPort {
  constructor(private readonly rpc: Rpc) {}

  async approve(request: RecoveryApprovalRequest): Promise<RecoveryApprovalResult> {
    return await this.rpc("ce_recovery_approval_commit", {
      p_tenant_id: request.tenantId,
      p_recovery_key: request.recoveryKey,
      p_idempotency_key: request.idempotencyKey,
      p_decision_hash: hashRecoveryDecision(request.decision),
      p_decision: request.decision,
      p_action: request.action,
      p_actor_id: request.actorId,
      p_actor_kind: request.actorKind,
      p_reason: request.reason ?? null,
    }) as RecoveryApprovalResult;
  }
}

export function createSupabaseRecoveryApprovalGate(): RecoveryApprovalPort {
  return new SupabaseRecoveryApprovalGate(async (name, body) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}`);
    return response.json();
  });
}
