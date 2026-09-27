import { storeIntelligenceMemory, promoteStrategyCandidate } from "@/lib/intelligence-core";

export type FailureType = "HYPOTHESIS"|"DATA"|"INTERPRETATION"|"DECISION"|"EXECUTION"|"TOOL"|"ENVIRONMENT"|"DEPENDENCY"|"UNKNOWN";
export type FailureSeverity = "LOW"|"MEDIUM"|"HIGH"|"CRITICAL";

function cfg(){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key};}
function headers(key:string){return{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};}
async function db(path:string,init:RequestInit={}){const c=cfg();const r=await fetch(`${c.url}/rest/v1/${path}`,{...init,cache:"no-store",headers:{...headers(c.key),...(init.headers||{})}});if(!r.ok)throw new Error(`FAILURE_LEARNING_DB_${r.status}`);return r;}

export function classifyFailure(input:{failureReason?:string; failedAction?:string; errorCode?:string}):FailureType{
 const s=(input.failureReason+" "+input.failedAction+" "+input.errorCode).toLowerCase();
 if(/hypothes|assumption|expected/.test(s)) return "HYPOTHESIS";
 if(/data|dataset|metric|measurement|missing value/.test(s)) return "DATA";
 if(/interpret|meaning|analysis|misread/.test(s)) return "INTERPRETATION";
 if(/decision|choice|priorit/.test(s)) return "DECISION";
 if(/tool|api|http|timeout|rate.?limit/.test(s)) return "TOOL";
 if(/depend|third.?party|provider/.test(s)) return "DEPENDENCY";
 if(/environment|config|deploy|runtime|permission/.test(s)) return "ENVIRONMENT";
 if(/execut|implementation|action|step/.test(s)) return "EXECUTION";
 return "UNKNOWN";
}

export function deriveRecoveryLearning(input:{
 failureType:FailureType; failureReason:string; recoveryAction?:string; recoveryResult?:string;
 recoverySuccess?:boolean|null; recoveryDeltaPct?:number|null;
}){
 const success=input.recoverySuccess===true;
 const unresolved=input.recoverySuccess===false||input.recoverySuccess==null;
 const lesson=success
  ? `Recovery for ${input.failureType} succeeded; retain the recovery pattern, but verify preconditions before reuse.`
  : unresolved
   ? `Recovery for ${input.failureType} is not sufficiently verified; do not treat it as a reliable remediation.`
   : `Recovery for ${input.failureType} failed; lower confidence and test a materially different remediation.`;
 const prevention=success
  ? [`Detect ${input.failureType} earlier and apply the recovery only when its preconditions are present.`]
  : [`Add an evidence or verification checkpoint before repeating the failed path.`];
 return {lesson,prevention,recoveryQuality:success?"VERIFIED":input.recoverySuccess===false?"NEGATIVE":"UNVERIFIED"};
}

export async function recordFailureLearning(input:{
 tenantId:string; missionId?:string; experienceId?:string; problem:string; failureType:FailureType;
 rootCause?:string; severity?:FailureSeverity; failedAction?:string; failureReason?:string;
 recoveryAction?:string; recoveryResult?:string; recoverySuccess?:boolean|null; recoveryDeltaPct?:number|null;
 evidence?:unknown[]; prevention?:unknown[]; confidence?:number;
}){
 const derived=deriveRecoveryLearning({failureType:input.failureType,failureReason:input.failureReason??"",recoveryAction:input.recoveryAction,recoveryResult:input.recoveryResult,recoverySuccess:input.recoverySuccess,recoveryDeltaPct:input.recoveryDeltaPct});
 const status=input.recoverySuccess===true?"RECOVERED":input.recoverySuccess===false?"UNRESOLVED":"OPEN";
 const response=await db("ce_intelligence_failures",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({
  tenant_id:input.tenantId,mission_id:input.missionId??null,experience_id:input.experienceId??null,
  problem:input.problem.slice(0,12000),failure_type:input.failureType,root_cause:input.rootCause??null,
  severity:input.severity??"MEDIUM",failed_action:input.failedAction??null,recovery_action:input.recoveryAction??null,
  recovery_result:input.recoveryResult??null,recovery_success:input.recoverySuccess??null,recovery_delta_pct:input.recoveryDeltaPct??null,
  confidence:input.confidence??(input.recoverySuccess===true?.8:.5),evidence:input.evidence??[],prevention:[...derived.prevention,...(input.prevention??[])],
  status,resolved_at:status==="RECOVERED"?new Date().toISOString():null
 })});
 const failure=(await response.json() as unknown[])[0] as Record<string,unknown>;
 await storeIntelligenceMemory({tenantId:input.tenantId,missionId:input.missionId,memoryType:"LESSON",
  title:`Failure learning: ${input.failureType}`,content:`${derived.lesson} Root cause: ${input.rootCause??"not established"}. Reason: ${input.failureReason??"not recorded"}`,
  confidence:input.recoverySuccess===true?.8:.5,source:"CORE_ENGINE_FAILURE_LEARNING",sourceRef:String(failure.id),tags:["failure-learning",input.failureType]});
 if(input.recoverySuccess!==null && input.recoverySuccess!==undefined){
   await promoteStrategyCandidate({tenantId:input.tenantId,problem:input.problem,
    strategy:input.recoverySuccess===true?`Recovery: ${input.recoveryAction??"validated remediation"}`:`Avoid/revise failed path: ${input.failedAction??input.problem}`,
    experienceId:input.experienceId,success:input.recoverySuccess,deltaPct:input.recoveryDeltaPct,
    confidence:input.recoverySuccess===true?.8:.35});
 }
 return {failure,learning:derived};
}