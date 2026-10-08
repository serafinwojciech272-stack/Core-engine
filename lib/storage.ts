import type{Decision,Mission,MissionState}from"@/lib/engine";import{ENGINE_VERSION}from"@/lib/engine";
type StorageMode="supabase"|"memory";const TIMEOUT=8000;function normalizeSupabaseUrl(value:string|undefined){let raw=(value||"").trim();if(raw.toUpperCase().startsWith("SUPABASE_URL")){const i=raw.indexOf("=");if(i>=0)raw=raw.slice(i+1).trim()}const quote=String.fromCharCode(34);const apostrophe=String.fromCharCode(39);if((raw.startsWith(quote)&&raw.endsWith(quote))||(raw.startsWith(apostrophe)&&raw.endsWith(apostrophe)))raw=raw.slice(1,-1).trim();if(!raw)return"";try{return new URL(raw).origin}catch{return""}}function cfg(){const url=normalizeSupabaseUrl(process.env.SUPABASE_URL),key=(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||"").trim();return url&&key?{url,key}:null}export function storageMode():StorageMode{return cfg()?"supabase":"memory"};async function sf(url:string,init:RequestInit={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT);try{return await fetch(url,{...init,cache:"no-store",signal:c.signal})}finally{clearTimeout(t)}}async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{const c=cfg();if(!c)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const r=await sf(c.url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error("SUPABASE_RPC_"+r.status);return r.json() as Promise<T>}
export async function checkStorageHealth(){const c=cfg();if(!c)return"not_configured" as const;try{const r=await sf(c.url+"/rest/v1/ce_missions?select=id&limit=1",{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});return r.ok?"pass" as const:"fail" as const}catch{return"fail" as const}}
export async function persistDecisionMission(d:Decision,m:Mission,engineVersion=ENGINE_VERSION){return rpc("ce_create_decision_mission",{p_decision_id:d.id,p_diagnosis:d.diagnosis,p_recommendation:d.recommendation,p_confidence:d.confidence,p_priority:d.priority,p_evidence:d.evidence,p_mission_id:m.id,p_objective:m.objective,p_state:m.state,p_kpi:m.kpi,p_engine_version:engineVersion,p_p1r:d.probability?.p1R??null,p_p2r:d.probability?.p2R??null,p_p3r:d.probability?.p3R??null,p_expected_r:d.expectedR??null,p_risk_gate:d.riskGate??"UNAVAILABLE",p_prediction_source:d.probability?.source??"DERIVED",p_calibration_status:d.probability?.calibration??"UNCALIBRATED",p_prediction_payload:{predictiveDecision:d.predictiveDecision??{},adaptivePolicy:d.adaptivePolicy??{}}})}
export async function claimPersistedAction(id:string,action:string,key:string){return rpc<{claimed:boolean;mission_id:string;action:string;idempotency_key:string}>("ce_claim_action",{p_mission_id:id,p_action:action,p_idempotency_key:key})}
export async function transitionPersistedMission(id:string,next:MissionState,actorType:"system"|"human"|"agent"){return rpc<{mission_id:string;decision_id:string;from_state:MissionState;to_state:MissionState;execution_count:number}>("ce_transition_mission",{p_mission_id:id,p_next_state:next,p_actor_type:actorType})}
export async function recordPersistedMissionOutcome(id:string,eventType:"EXECUTION_RECORDED"|"MEASUREMENT_RECORDED"|"LEARNING_RECORDED",metadata:Record<string,unknown>={}){return rpc("ce_record_mission_outcome",{p_mission_id:id,p_event_type:eventType,p_metadata:metadata})}
export async function recordPersistedLearning(missionId:string,lesson:{lessonType:string;quality:string;improved:boolean|null;delta:number|null;deltaPct:number|null;lesson:string;reason:string}){return rpc("ce_record_learning",{p_mission_id:missionId,p_lesson_type:lesson.lessonType,p_quality:lesson.quality,p_improved:lesson.improved,p_delta:lesson.delta,p_delta_pct:lesson.deltaPct,p_lesson:lesson.lesson,p_reason:lesson.reason})}
export type LearningContext={lessonType:"POSITIVE_DELTA"|"NEGATIVE_DELTA"|"UNVERIFIED";quality:"VERIFIED"|"NEGATIVE"|"UNVERIFIED";deltaPct:number|null;lesson:string;reason:string;kpi:string;createdAt:string};
export async function listPersistedLearning(limit=20):Promise<LearningContext[]>{const c=cfg();if(!c)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const r=await sf(c.url+"/rest/v1/ce_learning?select=lesson_type,quality,delta_pct,lesson,reason,created_at,ce_missions!inner(kpi)&order=created_at.desc&limit="+Math.min(50,Math.max(1,limit)),{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});if(!r.ok)throw new Error("SUPABASE_LEARNING_READ_"+r.status);const rows=await r.json() as Record<string,unknown>[];return rows.map(x=>({lessonType:x.lesson_type as LearningContext["lessonType"],quality:x.quality as LearningContext["quality"],deltaPct:x.delta_pct==null?null:Number(x.delta_pct),lesson:String(x.lesson),reason:String(x.reason),kpi:String((x.ce_missions as Record<string,unknown>).kpi),createdAt:String(x.created_at)}))}
export async function listPersistedMissions(limit=50):Promise<Mission[]>{const c=cfg();if(!c)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const r=await sf(c.url+"/rest/v1/ce_missions?select=id,decision_id,objective,state,kpi,created_at,updated_at,execution_count&order=created_at.desc&limit="+Math.min(100,Math.max(1,limit)),{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});if(!r.ok)throw new Error("SUPABASE_READ_"+r.status);const rows=await r.json() as Record<string,unknown>[];return rows.map(x=>({id:String(x.id),decisionId:String(x.decision_id),objective:String(x.objective),state:x.state as MissionState,kpi:String(x.kpi),createdAt:String(x.created_at),updatedAt:String(x.updated_at),executionCount:Number(x.execution_count)}))}
export type EngineEventRow={id:string;missionId:string;decisionId:string|null;eventType:string;fromState:string|null;toState:string|null;actorType:string;createdAt:string;metadata?:Record<string,unknown>};export async function listPersistedEvents(limit=100):Promise<EngineEventRow[]>{const c=cfg();if(!c)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const r=await sf(c.url+"/rest/v1/ce_events?select=id,mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata,created_at&order=created_at.desc&limit="+Math.min(100,Math.max(1,limit)),{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});if(!r.ok)throw new Error("SUPABASE_EVENTS_"+r.status);const rows=await r.json() as Record<string,unknown>[];return rows.map(x=>({id:String(x.id),missionId:String(x.mission_id),decisionId:x.decision_id==null?null:String(x.decision_id),eventType:String(x.event_type),fromState:x.from_state==null?null:String(x.from_state),toState:x.to_state==null?null:String(x.to_state),actorType:String(x.actor_type),createdAt:String(x.created_at),metadata:(x.metadata as Record<string,unknown>)||undefined}))}
export type PredictionLedgerEntry={id:string;decisionId:string;missionId:string;engineVersion:string;p1R:number;p2R:number;p3R:number;expectedR:number|null;riskGate:string;predictionSource:string;calibrationStatus:string;predictionPayload:Record<string,unknown>;outcomeStatus:"OPEN"|"WON"|"LOST"|"UNRESOLVED";realizedR:number|null;outcomePayload:Record<string,unknown>;createdAt:string;resolvedAt:string|null};
function mapPrediction(x:Record<string,unknown>):PredictionLedgerEntry{return{id:String(x.id),decisionId:String(x.decision_id),missionId:String(x.mission_id),engineVersion:String(x.engine_version),p1R:Number(x.p1r),p2R:Number(x.p2r),p3R:Number(x.p3r),expectedR:x.expected_r==null?null:Number(x.expected_r),riskGate:String(x.risk_gate),predictionSource:String(x.prediction_source),calibrationStatus:String(x.calibration_status),predictionPayload:(x.prediction_payload as Record<string,unknown>)||{},outcomeStatus:x.outcome_status as PredictionLedgerEntry["outcomeStatus"],realizedR:x.realized_r==null?null:Number(x.realized_r),outcomePayload:(x.outcome_payload as Record<string,unknown>)||{},createdAt:String(x.created_at),resolvedAt:x.resolved_at==null?null:String(x.resolved_at)}}
export async function resolvePersistedPrediction(id:string,realizedR:number|null,status:PredictionLedgerEntry["outcomeStatus"],payload:Record<string,unknown>={}){return rpc("ce_resolve_prediction",{p_mission_id:id,p_realized_r:realizedR,p_outcome_status:status,p_outcome_payload:payload})}
export async function listPersistedPredictions(limit=100):Promise<PredictionLedgerEntry[]>{const c=cfg();if(!c)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const r=await sf(c.url+"/rest/v1/ce_prediction_ledger?select=id,decision_id,mission_id,engine_version,p1r,p2r,p3r,expected_r,risk_gate,prediction_source,calibration_status,prediction_payload,outcome_status,realized_r,outcome_payload,created_at,resolved_at&order=created_at.desc&limit="+Math.min(200,Math.max(1,limit)),{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});if(!r.ok)throw new Error("SUPABASE_PREDICTION_READ_"+r.status);return(await r.json() as Record<string,unknown>[]).map(mapPrediction)}
export async function getPersistedPrediction(missionId:string){const c=cfg();if(!c)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");const r=await sf(c.url+"/rest/v1/ce_prediction_ledger?mission_id=eq."+encodeURIComponent(missionId)+"&select=id,decision_id,mission_id,engine_version,p1r,p2r,p3r,expected_r,risk_gate,prediction_source,calibration_status,outcome_status,realized_r,outcome_payload,created_at,resolved_at&limit=1",{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});if(!r.ok)throw new Error("SUPABASE_PREDICTION_READ_"+r.status);const rows=await r.json() as Record<string,unknown>[];return rows[0]?mapPrediction(rows[0]):null}

export async function persistTenderCase(caseId:string,title:string,fingerprint:string,dataset:Record<string,unknown>){
 const c=cfg(); if(!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
 const r=await sf(c.url+"/rest/v1/ce_tender_cases?on_conflict=case_id",{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify({case_id:caseId,title,fingerprint,dataset,updated_at:new Date().toISOString()})});
 if(!r.ok) throw new Error("SUPABASE_TENDER_CASE_"+r.status);
 const rows=await r.json() as Record<string,unknown>[]; return rows[0]||null;
}
export async function linkTenderCaseMission(caseId:string,missionId:string){
 const c=cfg(); if(!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
 const r=await sf(c.url+"/rest/v1/ce_tender_cases?case_id=eq."+encodeURIComponent(caseId),{method:"PATCH",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json","Prefer":"return=representation"},body:JSON.stringify({mission_id:missionId,updated_at:new Date().toISOString()})});
 if(!r.ok) throw new Error("SUPABASE_TENDER_CASE_LINK_"+r.status);
 return (await r.json() as Record<string,unknown>[])[0]||null;
}
export async function getPersistedTenderCase(caseId:string){
 const c=cfg(); if(!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
 const r=await sf(c.url+"/rest/v1/ce_tender_cases?case_id=eq."+encodeURIComponent(caseId)+"&select=*&limit=1",{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});
 if(!r.ok) throw new Error("SUPABASE_TENDER_CASE_READ_"+r.status);
 const rows=await r.json() as Record<string,unknown>[]; return rows[0]||null;
}

export async function getPersistedMissionSnapshot(missionId:string){
 const c=cfg(); if(!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
 const [mr,er,lr]=await Promise.all([
  sf(c.url+"/rest/v1/ce_missions?id=eq."+encodeURIComponent(missionId)+"&select=id,decision_id,objective,state,kpi,created_at,updated_at,execution_count&limit=1",{headers:{apikey:c.key,Authorization:"Bearer "+c.key}}),
  sf(c.url+"/rest/v1/ce_events?mission_id=eq."+encodeURIComponent(missionId)+"&select=id,event_type,from_state,to_state,actor_type,metadata,created_at&order=created_at.asc",{headers:{apikey:c.key,Authorization:"Bearer "+c.key}}),
  sf(c.url+"/rest/v1/ce_learning?mission_id=eq."+encodeURIComponent(missionId)+"&select=id,lesson_type,quality,improved,delta,delta_pct,lesson,reason,created_at&order=created_at.desc&limit=10",{headers:{apikey:c.key,Authorization:"Bearer "+c.key}})
 ]);
 if(!mr.ok||!er.ok||!lr.ok) throw new Error("SUPABASE_MISSION_SNAPSHOT_READ_FAILED");
 const missions=await mr.json() as Record<string,unknown>[];
 return {mission:missions[0]||null,events:await er.json(),learning:await lr.json()};
}

export type PersistedAgentStep={stepIndex:number;kind:string;status:"PENDING"|"RUNNING"|"SUCCEEDED"|"FAILED";input?:unknown;output?:unknown;error?:string};
export async function persistAgentFabricRun(input:{
 tenantId:string;project:string;goal:string;status:"PLANNED"|"RUNNING"|"COMPLETED"|"FAILED";
 metadata?:Record<string,unknown>;steps:PersistedAgentStep[];
}){
 const c=cfg(); if(!c) return {persisted:false,reason:"SUPABASE_SERVER_CONFIG_MISSING"} as const;
 try{
  const runResponse=await sf(c.url+"/rest/v1/ce_agent_runs",{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json","Prefer":"return=representation"},body:JSON.stringify({tenant_id:input.tenantId,project:input.project,goal:input.goal,status:input.status,metadata:input.metadata||{}})});
  if(!runResponse.ok) return {persisted:false,reason:"AGENT_RUN_"+runResponse.status} as const;
  const runs=await runResponse.json() as Array<{id:string}>;
  const runId=runs[0]?.id; if(!runId) return {persisted:false,reason:"AGENT_RUN_ID_MISSING"} as const;
  if(input.steps.length){
   const stepResponse=await sf(c.url+"/rest/v1/ce_agent_steps",{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(input.steps.map(s=>({run_id:runId,step_index:s.stepIndex,kind:s.kind,status:s.status,input:s.input??null,output:s.output??null,error:s.error??null,started_at:s.status==="PENDING"?null:new Date().toISOString(),finished_at:s.status==="SUCCEEDED"||s.status==="FAILED"?new Date().toISOString():null})))});
   if(!stepResponse.ok) return {persisted:false,runId,reason:"AGENT_STEPS_"+stepResponse.status} as const;
  }
  return {persisted:true,runId} as const;
 }catch(error){return {persisted:false,reason:String(error).slice(0,240)} as const}
}
export async function persistAgentToolEvent(input:{
 tenantId:string;project:string;runId?:string;toolId:string;action:string;status:string;approvalRequired:boolean;input?:unknown;output?:unknown;error?:string;
}){
 const c=cfg(); if(!c) return false;
 try{
  const r=await sf(c.url+"/rest/v1/ce_tool_events",{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({tenant_id:input.tenantId,project:input.project,run_id:input.runId||null,tool_id:input.toolId,action:input.action,status:input.status,approval_required:input.approvalRequired,input:input.input??null,output:input.output??null,error:input.error??null})});
  return r.ok;
 }catch{return false}
}
export async function persistAgentEvaluation(input:{
 tenantId:string;project:string;runId?:string;score:number;criteria:Record<string,unknown>;notes:string[];
}){
 const c=cfg(); if(!c) return false;
 try{
  const r=await sf(c.url+"/rest/v1/ce_evaluations",{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({tenant_id:input.tenantId,project:input.project,run_id:input.runId||null,score:Math.max(0,Math.min(1,input.score)),criteria:input.criteria,notes:input.notes})});
  return r.ok;
 }catch{return false}
}
export async function persistAgentLearning(input:{
 tenantId:string;project:string;runId?:string;signalType:string;value:Record<string,unknown>;
}){
 const c=cfg(); if(!c) return false;
 try{
  const r=await sf(c.url+"/rest/v1/ce_learning_signals",{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({tenant_id:input.tenantId,project:input.project,run_id:input.runId||null,signal_type:input.signalType,value:input.value})});
  return r.ok;
 }catch{return false}
}
export async function persistAgentOptimization(input:{
 tenantId:string;project:string;config:Record<string,unknown>;objective:number;decision:string;
}){
 const c=cfg(); if(!c) return false;
 try{
  const r=await sf(c.url+"/rest/v1/ce_optimization_runs",{method:"POST",headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({tenant_id:input.tenantId,project:input.project,config:input.config,objective:input.objective,decision:input.decision})});
  return r.ok;
 }catch{return false}
}

export type AgentMemoryRow={id:string;tenantId:string;project:string;key:string;value:unknown;importance:number;createdAt:string;updatedAt:string};

export async function upsertAgentMemory(input:{tenantId:string;project:string;key:string;value:unknown;importance?:number}):Promise<AgentMemoryRow|null>{
  const c=cfg(); if(!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const importance=Math.max(0,Math.min(1,input.importance??0.5));
  const r=await sf(c.url+"/rest/v1/ce_memory?on_conflict=tenant_id,project,key",{
    method:"POST",
    headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify({tenant_id:input.tenantId,project:input.project,key:input.key,value:input.value,importance,updated_at:new Date().toISOString()})
  });
  if(!r.ok) throw new Error("SUPABASE_MEMORY_UPSERT_"+r.status);
  const rows=await r.json() as Record<string,unknown>[];
  const row=rows[0]; if(!row) return null;
  return {id:String(row.id),tenantId:String(row.tenant_id),project:String(row.project),key:String(row.key),value:row.value,importance:Number(row.importance),createdAt:String(row.created_at),updatedAt:String(row.updated_at)};
}

export async function recallAgentMemory(input:{tenantId:string;project:string;key:string}):Promise<AgentMemoryRow|null>{
  const c=cfg(); if(!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const q=c.url+"/rest/v1/ce_memory?tenant_id=eq."+encodeURIComponent(input.tenantId)+"&project=eq."+encodeURIComponent(input.project)+"&key=eq."+encodeURIComponent(input.key)+"&select=id,tenant_id,project,key,value,importance,created_at,updated_at&limit=1";
  const r=await sf(q,{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});
  if(!r.ok) throw new Error("SUPABASE_MEMORY_READ_"+r.status);
  const rows=await r.json() as Record<string,unknown>[];
  const row=rows[0]; if(!row) return null;
  return {id:String(row.id),tenantId:String(row.tenant_id),project:String(row.project),key:String(row.key),value:row.value,importance:Number(row.importance),createdAt:String(row.created_at),updatedAt:String(row.updated_at)};
}

export async function listAgentMemory(input:{tenantId:string;project:string;limit?:number}):Promise<AgentMemoryRow[]>{
  const c=cfg(); if(!c) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  const limit=Math.min(100,Math.max(1,input.limit??20));
  const q=c.url+"/rest/v1/ce_memory?tenant_id=eq."+encodeURIComponent(input.tenantId)+"&project=eq."+encodeURIComponent(input.project)+"&select=id,tenant_id,project,key,value,importance,created_at,updated_at&order=importance.desc,updated_at.desc&limit="+limit;
  const r=await sf(q,{headers:{apikey:c.key,Authorization:"Bearer "+c.key}});
  if(!r.ok) throw new Error("SUPABASE_MEMORY_LIST_"+r.status);
  return (await r.json() as Record<string,unknown>[]).map(row=>({id:String(row.id),tenantId:String(row.tenant_id),project:String(row.project),key:String(row.key),value:row.value,importance:Number(row.importance),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}));
}
