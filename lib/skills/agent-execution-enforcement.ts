type AuthorizationResult={allowed:boolean;reason:string;compositionStatus:string|null;approvalStatus:string|null;missionState:string|null;authorizationId:string|null};

type ConsumptionVerificationResult={verified:boolean;reason:string;authorizationStatus:string|null;compositionStatus:string|null;missionState:string|null};

function cfg(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?{url,key}:null}
async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{const c=cfg();if(!c)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const r=await fetch(c.url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});if(!r.ok)throw new Error("SUPABASE_RPC_"+r.status);const value=await r.json();return(Array.isArray(value)?value[0]:value)as T}

export async function enforcePersistentAgentExecution(input:{compositionId:string;tenantId:string;missionId:string;capabilityId:string;correlationId:string;skillId?:string;skillVersion?:string;mode?:string}):Promise<AuthorizationResult>{
 if(!cfg())return{allowed:false,reason:"PERSISTENT_STATE_REQUIRED",compositionStatus:null,approvalStatus:null,missionState:null,authorizationId:null};
 if(!input.skillId||!input.skillVersion||!input.mode)return{allowed:false,reason:"EXECUTOR_SCOPE_REQUIRED",compositionStatus:null,approvalStatus:null,missionState:null,authorizationId:null};
 return rpc("ce_enforce_agent_execution",{p_composition_id:input.compositionId,p_tenant_id:input.tenantId,p_mission_id:input.missionId,p_capability_id:input.capabilityId,p_correlation_id:input.correlationId,p_skill_id:input.skillId,p_skill_version:input.skillVersion,p_mode:input.mode});
}

export async function closePersistentAgentExecution(input:{compositionId:string;authorizationId:string;success:boolean;reason?:string}){return rpc<{compositionStatus:string;missionState:string;result:string}>("ce_close_agent_execution",{p_composition_id:input.compositionId,p_authorization_id:input.authorizationId,p_success:input.success,p_reason:input.reason??null})}

export type PersistentExecutorScope={compositionId:string;authorizationId:string;tenantId:string;missionId:string;capabilityId:string;correlationId:string;skillId:string;skillVersion:string;mode:string};

export async function revokePersistentAgentExecution(input:{compositionId:string;authorizationId:string;reason:string}):Promise<{revoked:boolean;reason:string;status:string|null}>{
 if(!input.compositionId||!input.authorizationId||!input.reason.trim())return{revoked:false,reason:"EXECUTOR_REVOCATION_SCOPE_REQUIRED",status:null};
 if(!cfg())return{revoked:false,reason:"PERSISTENT_STATE_REQUIRED",status:null};
 return rpc("ce_revoke_agent_execution",{p_composition_id:input.compositionId,p_authorization_id:input.authorizationId,p_reason:input.reason.trim()});
}


export type OrphanedExecutionRecovery = {
  recoveryId:string;
  authorizationId:string;
  compositionId:string;
  tenantId:string;
  missionId:string;
  correlationId:string;
  classification:"EXPIRED_BEFORE_EXECUTION"|"UNKNOWN_SIDE_EFFECT";
  recoveryStatus:"PENDING_RECOVERY"|"RETRY_ALLOWED"|"SIDE_EFFECT_CONFIRMED"|"CLOSED";
};

export async function detectOrphanedAgentExecutions(limit=100):Promise<OrphanedExecutionRecovery[]>{
 if(!Number.isInteger(limit)||limit<1)return[];
 if(!cfg())throw new Error("PERSISTENT_STATE_REQUIRED");
 const value=await rpc<OrphanedExecutionRecovery[]>("ce_detect_orphaned_agent_executions",{p_limit:Math.min(500,limit)});
 return Array.isArray(value)?value:[];
}

export async function reconcileOrphanedAgentExecution(input:{
 recoveryId:string;
 resolution:"NO_SIDE_EFFECT"|"SIDE_EFFECT_CONFIRMED";
 actorId:string;
 reason:string;
 evidenceIds?:string[];
}):Promise<{resolved:boolean;result:string;classification:string|null;recoveryStatus:string|null;missionState:string|null;authorizationStatus:string|null}>{
 if(!input.recoveryId||!input.actorId||!input.reason.trim())return{resolved:false,result:"RECOVERY_RECONCILIATION_SCOPE_REQUIRED",classification:null,recoveryStatus:null,missionState:null,authorizationStatus:null};
 if(!cfg())return{resolved:false,result:"PERSISTENT_STATE_REQUIRED",classification:null,recoveryStatus:null,missionState:null,authorizationStatus:null};
 return rpc("ce_reconcile_orphaned_agent_execution",{p_recovery_id:input.recoveryId,p_resolution:input.resolution,p_actor_id:input.actorId,p_reason:input.reason.trim(),p_evidence_ids:input.evidenceIds??[]});
}
\nexport async function verifyPersistentAgentExecutionConsumption(input:PersistentExecutorScope&{expectedResult:"SUCCESS"|"FAILURE"}):Promise<ConsumptionVerificationResult>{
 const required=[input.compositionId,input.authorizationId,input.tenantId,input.missionId,input.capabilityId,input.correlationId,input.skillId,input.skillVersion,input.mode];
 if(required.some((value)=>!value))return{verified:false,reason:"EXECUTOR_CONSUMPTION_SCOPE_REQUIRED",authorizationStatus:null,compositionStatus:null,missionState:null};
 if(!cfg())return{verified:false,reason:"PERSISTENT_STATE_REQUIRED",authorizationStatus:null,compositionStatus:null,missionState:null};
 return rpc("ce_verify_agent_execution_consumption",{p_composition_id:input.compositionId,p_authorization_id:input.authorizationId,p_tenant_id:input.tenantId,p_mission_id:input.missionId,p_capability_id:input.capabilityId,p_correlation_id:input.correlationId,p_skill_id:input.skillId,p_skill_version:input.skillVersion,p_mode:input.mode,p_expected_result:input.expectedResult});
}
