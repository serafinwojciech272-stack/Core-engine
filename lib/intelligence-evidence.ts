import { randomUUID, createHash } from "node:crypto";
import type { VerificationResult } from "./result-verification";

export type IntelligenceEvidence={
  requestId:string; engineVersion:string; project:string; mode:string; domain:string; complexity:number;
  selectedModels:string[]; judgeModel?:string; toolRuns:Array<{tool:string;status:string;latencyMs?:number}>;
  verification:VerificationResult; approvalState:"NOT_REQUIRED"|"REQUIRED"|"BLOCKED";
  sideEffects:"NONE"|"BLOCKED_UNTIL_APPROVED"; latencyMs:number; createdAt:string;
};

export function buildIntelligenceEvidence(input:Omit<IntelligenceEvidence,"requestId"|"createdAt">):IntelligenceEvidence{
  return{...input,requestId:"ce-ev-"+randomUUID(),createdAt:new Date().toISOString()};
}

function cfg(){
  let url=(process.env.SUPABASE_URL||"").trim();
  const secret=(process.env.SUPABASE_SECRET_KEY||"").trim();
  const legacy=(process.env.SUPABASE_SERVICE_ROLE_KEY||"").trim();
  const key=secret||legacy;
  const keyType=secret?"secret":"service_role";
  if(url.toUpperCase().startsWith("SUPABASE_URL")){
    const i=url.indexOf("="); if(i>=0) url=url.slice(i+1).trim();
  }
  if((url.startsWith(String.fromCharCode(34))&&url.endsWith(String.fromCharCode(34)))||(url.startsWith(String.fromCharCode(39))&&url.endsWith(String.fromCharCode(39)))) url=url.slice(1,-1).trim();
  try{url=new URL(url).origin}catch{return null}
  return url&&key?{url,key,keyType}:null;
}

async function insert(path:string,row:Record<string,unknown>){
  const c=cfg();
  if(!c){console.warn("[intelligence-evidence] Supabase persistence not configured");return false;}
  try{
    const headers:Record<string,string>={apikey:c.key,"Content-Type":"application/json",Prefer:"return=minimal"};
    if(c.keyType==="service_role") headers.Authorization=["Bearer",c.key].join(" ");
    const r=await fetch(c.url+"/rest/v1/"+path,{method:"POST",headers,body:JSON.stringify(row)});
    if(!r.ok){
      const detail=(await r.text()).slice(0,500);
      console.error("[intelligence-evidence] Supabase insert failed",{path,status:r.status,keyType:c.keyType,detail});
    }
    return r.ok;
  }catch(error){
    console.error("[intelligence-evidence] Supabase insert exception",{path,keyType:c.keyType,error:String(error).slice(0,500)});
    return false;
  }
}

export async function recordIntelligenceEvidence(input:Omit<IntelligenceEvidence,"requestId"|"createdAt">){
  const e=buildIntelligenceEvidence(input);
  const payload={...e,recordedAt:new Date().toISOString()};
  const hash=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const tenant=process.env.CORE_ENGINE_TENANT_ID?.trim()||"core-engine";
  const audit=await insert("ce_intelligence_audit_events",{tenant_id:tenant,request_id:e.requestId,event_type:"M-AI-10_EVIDENCE_RECORDED",event_hash:hash,payload});
  const learning=await insert("ce_intelligence_learning_events",{tenant_id:tenant,request_id:e.requestId,prediction:e.selectedModels[0]||"unknown",actual_outcome:e.verification.passed?"VERIFIED":"UNVERIFIED",prediction_correct:e.verification.passed,calibration_delta:(e.verification.score-75)/25,signal:"MODEL_PERFORMANCE",model_version:"M-AI-10",payload:{models:e.selectedModels,judgeModel:e.judgeModel,domain:e.domain,complexity:e.complexity,latencyMs:e.latencyMs,verificationScore:e.verification.score,passed:e.verification.passed,toolRuns:e.toolRuns,approvalState:e.approvalState}});
  return{persisted:audit&&learning,hash,audit,learning};
}
