type AuthorizationResult={allowed:boolean;reason:string;compositionStatus:string|null;approvalStatus:string|null;missionState:string|null;authorizationId:string|null};

function cfg(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?{url,key}:null}

async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 const c=cfg();if(!c)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
 const r=await fetch(c.url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
 if(!r.ok)throw new Error("SUPABASE_RPC_"+r.status);
 const value=await r.json();return (Array.isArray(value)?value[0]:value) as T;
}

export async function enforcePersistentAgentExecution(input:{
 compositionId:string;tenantId:string;missionId:string;capabilityId:string;correlationId:string;
 skillId:string;skillVersion:string;mode:string;
}):Promise<AuthorizationResult>{
 if(!cfg())return{allowed:false,reason:"PERSISTENT_STATE_REQUIRED",compositionStatus:null,approvalStatus:null,missionState:null,authorizationId:null};
 return rpc("ce_enforce_agent_execution",{
   p_composition_id:input.compositionId,p_tenant_id:input.tenantId,p_mission_id:input.missionId,
   p_capability_id:input.capabilityId,p_correlation_id:input.correlationId,
   p_skill_id:input.skillId,p_skill_version:input.skillVersion,p_mode:input.mode
 });
}

export async function closePersistentAgentExecution(input:{compositionId:string;authorizationId:string;success:boolean;reason?:string}){
 return rpc<{compositionStatus:string;missionState:string;result:string}>("ce_close_agent_execution",{
   p_composition_id:input.compositionId,p_authorization_id:input.authorizationId,p_success:input.success,p_reason:input.reason??null
 });
}
