import { recallIntelligence } from "@/lib/intelligence-core";

type ClaimStatus = "KNOWN"|"LOW_CONFIDENCE"|"UNKNOWN"|"CONTRADICTORY"|"STALE"|"UNVERIFIED";
type UnknownStatus = "OPEN"|"RESEARCHING"|"RESOLVED"|"WONT_RESOLVE";
type DbConfig={url:string;key:string};

function cfg():DbConfig {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return {url,key};
}
function h(key:string){return {apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};}
async function db(path:string,init:RequestInit={}){
  const c=cfg(); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(`${c.url}/rest/v1/${path}`,{...init,cache:"no-store",signal:controller.signal,headers:{...h(c.key),...(init.headers||{})}});
    if(!response.ok) throw new Error(`INTELLIGENCE_KNOWLEDGE_DB_${response.status}`);
    return response;
  } finally{clearTimeout(timer);}
}
function keyOf(claim:string){return claim.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ").slice(0,500);}
function clampConfidence(v:number|undefined){return v===undefined?undefined:Math.max(0,Math.min(1,v));}

export async function upsertKnowledgeClaim(input:{
  tenantId:string; claim:string; claimKey?:string; domain?:string; status?:ClaimStatus; confidence?:number;
  source?:string; sourceRef?:string; observedAt?:string; verifiedAt?:string; expiresAt?:string; metadata?:Record<string,unknown>;
}){
  const c=cfg(); const claimKey=input.claimKey||keyOf(input.claim);
  const url=new URL(`${c.url}/rest/v1/ce_intelligence_knowledge_claims`);
  url.searchParams.set("on_conflict","tenant_id,claim_key");
  const response=await db(url.pathname.slice(1)+url.search,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({
    tenant_id:input.tenantId,claim_key:claimKey,claim:input.claim.slice(0,12000),domain:input.domain??null,
    status:input.status??"UNVERIFIED",confidence:clampConfidence(input.confidence)??null,source:input.source??"CORE_ENGINE",
    source_ref:input.sourceRef??null,observed_at:input.observedAt??null,verified_at:input.verifiedAt??null,
    expires_at:input.expiresAt??null,metadata:input.metadata??{}
  })});
  const rows=await response.json() as unknown[]; return rows[0]??null;
}

export async function markClaimStale(tenantId:string,claimId:string){
  const url=new URL(`${cfg().url}/rest/v1/ce_intelligence_knowledge_claims`);
  url.searchParams.set("tenant_id",`eq.${tenantId}`); url.searchParams.set("id",`eq.${claimId}`);
  const response=await db(url.pathname.slice(1)+url.search,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"STALE",updated_at:new Date().toISOString()})});
  const rows=await response.json() as unknown[]; return rows[0]??null;
}

export async function relateKnowledgeClaims(input:{
  tenantId:string; fromClaimId:string; toClaimId:string; relationType:"SUPPORTS"|"CONTRADICTS"|"SUPERSEDES"|"DERIVED_FROM";
  confidence?:number; source?:string; metadata?:Record<string,unknown>;
}){
  const response=await db("ce_intelligence_claim_relations",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({
    tenant_id:input.tenantId,from_claim_id:input.fromClaimId,to_claim_id:input.toClaimId,relation_type:input.relationType,
    confidence:clampConfidence(input.confidence)??null,source:input.source??"CORE_ENGINE",metadata:input.metadata??{}
  })});
  const rows=await response.json() as unknown[];
  if(input.relationType==="CONTRADICTS"){
    for(const id of [input.fromClaimId,input.toClaimId]){
      const u=new URL(`${cfg().url}/rest/v1/ce_intelligence_knowledge_claims`);
      u.searchParams.set("tenant_id",`eq.${input.tenantId}`);u.searchParams.set("id",`eq.${id}`);
      await db(u.pathname.slice(1)+u.search,{method:"PATCH",body:JSON.stringify({status:"CONTRADICTORY",updated_at:new Date().toISOString()})});
    }
  }
  return rows[0]??null;
}

export async function openUnknown(input:{
  tenantId:string; question:string; domain?:string; priority?:number; evidenceRequired?:unknown[]; confidence?:number; linkedMissionId?:string;
}){
  const response=await db("ce_intelligence_unknowns",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({
    tenant_id:input.tenantId,question:input.question.slice(0,12000),domain:input.domain??null,priority:Math.max(0,Math.min(100,input.priority??50)),
    status:"OPEN",evidence_required:input.evidenceRequired??[],confidence:clampConfidence(input.confidence)??null,linked_mission_id:input.linkedMissionId??null
  })});
  const rows=await response.json() as unknown[]; return rows[0]??null;
}

export async function resolveUnknown(input:{tenantId:string;unknownId:string;resolution:Record<string,unknown>;confidence?:number;status?:Exclude<UnknownStatus,"OPEN"|"RESEARCHING">}){
  const url=new URL(`${cfg().url}/rest/v1/ce_intelligence_unknowns`);
  url.searchParams.set("tenant_id",`eq.${input.tenantId}`);url.searchParams.set("id",`eq.${input.unknownId}`);
  const response=await db(url.pathname.slice(1)+url.search,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({
    status:input.status??"RESOLVED",resolution:input.resolution,confidence:clampConfidence(input.confidence)??null,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()
  })});
  const rows=await response.json() as unknown[]; return rows[0]??null;
}

export async function recallKnowledge(input:{tenantId:string;query?:string;domain?:string;limit?:number;includeUnknowns?:boolean}){
  const c=cfg(); const url=new URL(`${c.url}/rest/v1/ce_intelligence_knowledge_claims`);
  url.searchParams.set("tenant_id",`eq.${input.tenantId}`); url.searchParams.set("select","id,claim_key,claim,domain,status,confidence,source,source_ref,observed_at,verified_at,expires_at,metadata,updated_at");
  url.searchParams.set("order","updated_at.desc"); url.searchParams.set("limit","200");
  const response=await fetch(url,{headers:h(c.key),cache:"no-store"}); if(!response.ok) throw new Error(`INTELLIGENCE_CLAIMS_${response.status}`);
  let claims=await response.json() as Array<Record<string,unknown>>;
  const now=Date.now();
  claims=claims.map(x=>({...x,staleByDate:!!x.expires_at&&new Date(String(x.expires_at)).getTime()<now}))
    .filter(x=>!input.domain||x.domain===input.domain)
    .filter(x=>x.status!=="STALE"&&!x.staleByDate)
    .filter(x=>!input.query||String(x.claim).toLowerCase().includes(input.query.toLowerCase())||String(x.claim_key).includes(keyOf(input.query)))
    .slice(0,Math.max(1,Math.min(input.limit??20,50)));
  const unknowns=input.includeUnknowns===false?[]:await listOpenUnknowns(input.tenantId,input.domain,10);
  const memories=input.query?await recallIntelligence({tenantId:input.tenantId,query:input.query,domain:input.domain,limit:Math.min(10,input.limit??10)}):[];
  return {claims,unknowns,memories};
}

export async function listOpenUnknowns(tenantId:string,domain?:string,limit=20){
  const c=cfg(); const url=new URL(`${c.url}/rest/v1/ce_intelligence_unknowns`);
  url.searchParams.set("tenant_id",`eq.${tenantId}`);url.searchParams.set("status","in.(OPEN,RESEARCHING)");
  url.searchParams.set("select","id,question,domain,priority,status,evidence_required,confidence,linked_mission_id,created_at,updated_at");
  url.searchParams.set("order","priority.desc,created_at.asc");url.searchParams.set("limit",String(Math.min(50,Math.max(1,limit)));
  const response=await fetch(url,{headers:h(c.key),cache:"no-store"});if(!response.ok)throw new Error(`INTELLIGENCE_UNKNOWNS_${response.status}`);
  const rows=await response.json() as Array<Record<string,unknown>>; return domain?rows.filter(x=>x.domain===domain):rows;
}

export async function buildWorldModel(input:{tenantId:string;domain?:string;goals?:unknown[];constraints?:unknown[];entities?:unknown[];kpis?:unknown[];priorities?:unknown[];activeHypotheses?:unknown[];assumptions?:unknown[]}){
  const domain=input.domain??"global";
  const claims=await recallKnowledge({tenantId:input.tenantId,domain,limit:30,includeUnknowns:true});
  const payload={
    tenant_id:input.tenantId,domain,
    version:1,goals:input.goals??[],constraints:input.constraints??[],entities:input.entities??[],kpis:input.kpis??[],
    priorities:input.priorities??[],active_hypotheses:input.activeHypotheses??[],assumptions:input.assumptions??[],
    knowledge_snapshot:{generated_at:new Date().toISOString(),claims:claims.claims,unknowns:claims.unknowns,memories:claims.memories}
  };
  const response=await db("ce_intelligence_world_state",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(payload)});
  const rows=await response.json() as unknown[];return rows[0]??null;
}
