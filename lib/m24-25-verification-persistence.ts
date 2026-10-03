import type { RecoveryVerificationResult } from "@/lib/m24-25-verification-engine";

type Rpc=(name:string,body:Record<string,unknown>)=>Promise<unknown>;
export class SupabaseRecoveryVerificationPersistence {
 constructor(private readonly rpc:Rpc){}
 async commit(result:RecoveryVerificationResult,observedState:Record<string,unknown>){return this.rpc("ce_recovery_verification_commit",{p_tenant_id:result.tenantId,p_recovery_key:result.recoveryKey,p_execution_id:result.executionId,p_action:result.action,p_outcome:result.outcome,p_learning_signal:result.learningSignal,p_matched_keys:result.matchedKeys,p_mismatched_keys:result.mismatchedKeys,p_verification_hash:result.verificationHash,p_verified_at:result.verifiedAt,p_reason:result.reason,p_observed_state:observedState});}
 async read(tenantId:string,recoveryKey:string){return this.rpc("ce_recovery_verification_read",{p_tenant_id:tenantId,p_recovery_key:recoveryKey});}
}
export function createSupabaseRecoveryVerificationPersistence(){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const rpc:Rpc=async(name,body)=>{const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});if(!response.ok)throw new Error(`SUPABASE_RPC_${response.status}`);return response.json();};return new SupabaseRecoveryVerificationPersistence(rpc);}
