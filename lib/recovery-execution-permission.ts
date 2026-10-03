export type ExecutionPermissionResult = {
  approvalId: string;
  tenantId: string;
  recoveryKey: string;
  decision: "NO_ACTION" | "RESUME" | "REPLAY" | "RECONCILE";
  action: "APPROVE" | "REJECT";
  executionPermission: "GRANTED" | "DENIED";
  approvedBy: string;
  approvedAt: string;
  decisionHash: string;
};

type Rpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;

export class SupabaseExecutionPermissionReader {
  constructor(private readonly rpc: Rpc) {}

  async read(
    tenantId: string,
    recoveryKey: string,
    approvalId?: string | null,
  ): Promise<ExecutionPermissionResult | null> {
    return await this.rpc("ce_recovery_execution_permission_read", {
      p_tenant_id: tenantId,
      p_recovery_key: recoveryKey,
      p_approval_id: approvalId ?? null,
    }) as ExecutionPermissionResult | null;
  }
}

export function createSupabaseExecutionPermissionReader() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");

  return new SupabaseExecutionPermissionReader(async (name, body) => {
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
