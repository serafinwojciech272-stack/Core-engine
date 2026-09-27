import { classifyFailure, type FailureType } from "@/lib/failure-recovery-learning";

type RecoveryInput = {
  tenantId:string; problem:string; failureType?:FailureType; failedAction?:string;
  failureReason?:string; recoveryAction:string; recoveryResult?:string;
  recoverySuccess?:boolean|null; recoveryDeltaPct?:number|null; preconditions?:string[];
  failureId?:string;
};
function cfg(){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key};}
function headers(key:string){return{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};}
async function db(path:string,init:RequestInit={}){const c=cfg();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(`${c.url}/rest/v1/${path}`,{...init,cache:"no-store",signal:controller.signal,headers:{...headers(c.key),...(init.headers||{})}});if(!r.ok)throw new Error(`RECOVERY_PATTERN_DB_${r.status}`);return r;}finally{clearTimeout(timer);}}
function normalize(v:string){return v.toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu," ").replace(/\\s+/g," ").trim();}
function signature(input:RecoveryInput,type:FailureType){return normalize(`${type}|\${input.recoveryAction}`);}
function key(sig:string){return sig.slice(0,240);}
export function buildRecoveryPattern(input:RecoveryInput){
 const failureType=input.failureType??classifyFailure({failureReason:input.failureReason,failedAction:input.failedAction});
 const triggerSignature=signature(input,failureType);
 return {failureType,triggerSignature,patternKey:key(triggerSignature),preconditions:input.preconditions??[],recoverySteps:[input.recoveryAction].filter(Boolean)};
}
export async function generalizeRecoveryPattern(input:RecoveryInput){
 if(!input.recoveryAction?.trim()) throw new Error("RECOVERY_ACTION_REQUIRED");
 const built=buildRecoveryPattern(input), c=cfg();
 const lookup=new URL(`${c.url}/rest/v1/ce_intelligence_recovery_patterns`);
 lookup.searchParams.set("tenant_id",`eq.${input.tenantId}`);
 lookup.searchParams.set("pattern_key",`eq.${built.patternKey}`);
 lookup.searchParams.set("order","version.desc"); lookup.searchParams.set("limit","1");
 const foundResponse=await fetch(lookup,{headers:headers(c.key),cache:"no-store"});
 if(!foundResponse.ok) throw new Error(`RECOVERY_PATTERN_LOOKUP_${foundResponse.status}`);
 const found=await foundResponse.json() as Array<Record<string,unknown>>;
 const prior=found[0];
 const verified=input.recoverySuccess===true, failed=input.recoverySuccess===false;
 const evidence=Number(prior?.evidence_count??0)+(verified||failed?1:0);
 const successCount=Number(prior?.success_count??0)+(verified?1:0);
 const failureCount=Number(prior?.failure_count??0)+(failed?1:0);
 const successRate=evidence?successCount/evidence:null;
 const priorDelta=typeof prior?.avg_recovery_delta_pct==="number"?Number(prior.avg_recovery_delta_pct):null;
 const avgDelta=input.recoveryDeltaPct==null?priorDelta:priorDelta==null?input.recoveryDeltaPct:((priorDelta*(evidence-1))+input.recoveryDeltaPct)/evidence;
 const confidence=Math.max(0,Math.min(1,verified?.85:failed?.25:.5));
 const status=successRate!=null&&evidence>=2&&successRate>=.7?"ACTIVE":"EXPERIMENTAL";
 const body={tenant_id:input.tenantId,pattern_key:built.patternKey,failure_types:[built.failureType],
  trigger_signature:built.triggerSignature,preconditions:built.preconditions,recovery_steps:built.recoverySteps,
  source_failure_ids:input.failureId?[input.failureId]:[],evidence_count:evidence,success_count:successCount,
  failure_count:failureCount,success_rate:successRate,avg_recovery_delta_pct:avgDelta,confidence,status,
  version:Number(prior?.version??0)+1,supersedes_id:prior?.id??null};
 const response=await db("ce_intelligence_recovery_patterns",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
 const rows=await response.json() as unknown[]; return rows[0]??null;
}
export async function recallRecoveryPatterns(input:{tenantId:string; failureType?:FailureType; query?:string; limit?:number}){
 const c=cfg(), url=new URL(`${c.url}/rest/v1/ce_intelligence_recovery_patterns`);
 url.searchParams.set("tenant_id",`eq.${input.tenantId}`); url.searchParams.set("status","neq.DEPRECATED");
 url.searchParams.set("select","id,pattern_key,failure_types,trigger_signature,preconditions,recovery_steps,evidence_count,success_count,failure_count,success_rate,avg_recovery_delta_pct,confidence,status,version,created_at");
 url.searchParams.set("order","confidence.desc,created_at.desc"); url.searchParams.set("limit",String(Math.min(input.limit??10,50)));
 const r=await fetch(url,{headers:headers(c.key),cache:"no-store"}); if(!r.ok)throw new Error(`RECOVERY_PATTERN_RECALL_${r.status}`);
 const rows=await r.json() as Array<Record<string,unknown>>;
 return rows.filter(row=>!input.failureType||Array.isArray(row.failure_types)&&row.failure_types.includes(input.failureType))
  .filter(row=>!input.query||normalize(`${row.trigger_signature} ${JSON.stringify(row.recovery_steps)}`).includes(normalize(input.query)));
}