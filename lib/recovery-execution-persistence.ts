import type { RecoveryExecutionEvent } from "@/lib/recovery-executor";

type Rpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;

export type RecoveryPostExecutionState = {
  tenantId: string;
  recoveryKey: string;
  executionId: string;
  status: "EXECUTED" | "NOOP" | "FAILED";
  action: "RESUME" | "REPLAY" | "RECONCILE";
  executionHash: string;
  state: Record<string, unknown>;
  updatedAt: string;
};

export class SupabaseRecoveryExecutionPersistence {
  constructor(private readonly rpc: Rpc) {}

  async commit(event: RecoveryExecutionEvent, state: Record<string, unknown>) {
    return await this.rpc("ce_recovery_execution_commit", {
      p_execution_id: event.executionId,
      p_tenant_id: event.tenantId,
      p_recovery_key: event.recoveryKey,
      p_approval_id: event.approvalId,
      p_decision_hash: event.decisionHash,
      p_execution_hash: event.executionHash,
      p_action: event.action,
      p_status: event.status,
      p_executed_by: event.executedBy,
      p_executed_at: event.executedAt,
      p_state: state,
    });
  }

  async read(tenantId: string, recoveryKey: string): Promise<RecoveryPostExecutionState | null> {
    return await this.rpc("ce_recovery_post_execution_read", {
      p_tenant_id: tenantId,
      p_recovery_key: recoveryKey,
    }) as RecoveryPostExecutionState | null;
  }
}

export function createSupabaseRecoveryExecutionPersistence() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const rpc: Rpc = async (name, body) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store",
    });
    if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}`);
    return response.json();
  };
  return new SupabaseRecoveryExecutionPersistence(rpc);
}
