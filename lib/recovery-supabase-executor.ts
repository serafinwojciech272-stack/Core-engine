import type { RecoveryExecutorInput, RecoveryExecutionEvent, RecoveryExecutorPort } from "@/lib/recovery-executor";
import { ExecutionConflictError, ExecutionPermissionDeniedError } from "@/lib/recovery-executor";

type Rpc = (name: string, body: Record<string, unknown>) => Promise<any>;

export class SupabaseRecoveryExecutor implements RecoveryExecutorPort {
  constructor(private readonly rpc: Rpc) {}

  async execute(input: RecoveryExecutorInput): Promise<RecoveryExecutionEvent> {
    const p = input.permission;
    if (p.tenantId !== input.tenantId || p.recoveryKey !== input.recoveryKey || p.executionPermission !== "GRANTED" || p.action !== "APPROVE") {
      throw new ExecutionPermissionDeniedError();
    }
    if (!["RESUME", "REPLAY", "RECONCILE"].includes(p.decision)) {
      throw new ExecutionPermissionDeniedError();
    }
    const executionHash = await this.hash(input);
    const result = await this.rpc("ce_recovery_execution_commit", {
      p_execution_id: crypto.randomUUID(),
      p_tenant_id: input.tenantId,
      p_recovery_key: input.recoveryKey,
      p_approval_id: input.permission.approvalId,
      p_decision_hash: input.permission.decisionHash,
      p_execution_hash: executionHash,
      p_action: p.decision,
      p_status: "EXECUTED",
      p_executed_by: p.approvedBy,
      p_executed_at: new Date().toISOString(),
      p_state: input.checkpoint,
    });
    return {
      executionId: result.executionId,
      tenantId: input.tenantId,
      recoveryKey: input.recoveryKey,
      action: p.decision,
      status: "EXECUTED",
      approvalId: p.approvalId,
      decisionHash: p.decisionHash,
      executionHash: result.executionHash ?? executionHash,
      executedBy: p.approvedBy,
      executedAt: new Date().toISOString(),
    };
  }

  private async hash(input: RecoveryExecutorInput) {
    const data = JSON.stringify({ tenantId: input.tenantId, recoveryKey: input.recoveryKey, approvalId: input.permission.approvalId, decisionHash: input.permission.decisionHash, decision: input.permission.decision, checkpoint: input.checkpoint });
    const bytes = new TextEncoder().encode(data);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
  }
}

export function createSupabaseRecoveryExecutor(): RecoveryExecutorPort {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const rpc: Rpc = async (name, body) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}`);
    return response.json();
  };
  return new SupabaseRecoveryExecutor(rpc);
}
