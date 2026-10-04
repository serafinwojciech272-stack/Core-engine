import type { RecoveryExecutorInput, RecoveryExecutionEvent, RecoveryExecutorPort, RecoveryExecutionAction } from "@/lib/recovery-executor";
import { ExecutionPermissionDeniedError } from "@/lib/recovery-executor";

type Rpc = (name:string,body:Record<string,unknown>)=>Promise<any>;

export class SupabaseRecoveryExecutor implements RecoveryExecutorPort {
 constructor(private readonly rpc:Rpc){}
 async execute(input:RecoveryExecutorInput):Promise<RecoveryExecutionEvent>{
  const p=input.permission;
  const executableDecision = p.decision === "RESUME" || p.decision === "REPLAY" || p.decision === "RECONCILE";
  if(p.tenantId!==input.tenantId||p.recoveryKey!==input.recoveryKey||p.executionPermission!=="GRANTED"||p.action!=="APPROVE"||!executableDecision) throw new ExecutionPermissionDeniedError();
  const executionAction = p.decision as RecoveryExecutionAction;
  const executionHash=await this.hash(input); const executionId=crypto.randomUUID(); const executedAt=new Date().toISOString();
  const result=await this.rpc("ce_recovery_execution_commit",{p_execution_id:executionId,p_tenant_id:input.tenantId,p_recovery_key:input.recoveryKey,p_idempotency_key:input.idempotencyKey,p_approval_id:p.approvalId,p_decision_hash:p.decisionHash,p_execution_hash:executionHash,p_action:executionAction,p_status:"EXECUTED",p_executed_by:p.approvedBy,p_executed_at:executedAt,p_state:input.checkpoint});
  return {executionId:result.executionId,tenantId:input.tenantId,recoveryKey:input.recoveryKey,action:executionAction,status:"EXECUTED",approvalId:p.approvalId,decisionHash:p.decisionHash,executionHash:result.executionHash??executionHash,executedBy:p.approvedBy,executedAt};
 }
 private async hash(input:RecoveryExecutorInput){const data=JSON.stringify({tenantId:input.tenantId,recoveryKey:input.recoveryKey,approvalId:input.permission.approvalId,decisionHash:input.permission.decisionHash,decision:input.permission.decision,checkpoint:input.checkpoint});const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(data));return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");}
}
export function createSupabaseRecoveryExecutor():RecoveryExecutorPort{const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const rpc:Rpc=async(name,body)=>{const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});if(!response.ok)throw new Error(`SUPABASE_RPC_${response.status}`);return response.json();};return new SupabaseRecoveryExecutor(rpc);}
