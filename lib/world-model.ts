import { unknownKeyFromQuestion, worldContextLimit } from "@/lib/world-model-testable";

export type WorldKnowledgeStatus = "KNOWN" | "KNOWN_WITH_LOW_CONFIDENCE" | "UNKNOWN" | "STALE" | "CONTRADICTORY" | "UNVERIFIED";
export type WorldClaim = { id:string; tenant_id:string; subject_key:string; predicate:string; object_value:unknown; value_type:string; domain?:string|null; confidence?:number|null; source?:string|null; source_ref?:string|null; observed_at?:string|null; valid_until?:string|null; status:string; created_at:string; };
export type WorldUnknown = { id:string; domain:string; key:string; question:string; importance:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL"; status:"OPEN"|"RESOLVED"|"STALE"|"BLOCKED"; evidence_needed:unknown[]; };
export type WorldContradiction = { id:string; subject_key:string; predicate:string; claim_a_id:string; claim_b_id:string; status:string; conflict_type:string; resolution?:string|null; winning_claim_id?:string|null; };
export type WorldState = { tenantId:string; domain:string; generatedAt:string; modelVersion:"m10.2"; completeness:number; confidence:number; facts:Record<string,{value:unknown;status:WorldKnowledgeStatus;confidence:number;source?:string|null;observedAt?:string|null;claimId:string}>; entities:Array<{id:string;type:string;name:string;confidence?:number|null;status:string}>; unknowns:WorldUnknown[]; contradictions:WorldContradiction[]; staleClaims:WorldClaim[]; claims:WorldClaim[]; };
type DbConfig={url:string;key:string};
function normalizeSupabaseUrl(value:string|undefined){let raw=(value||"").trim();if(raw.toUpperCase().startsWith("SUPABASE_URL")){const i=raw.indexOf("=");if(i>=0)raw=raw.slice(i+1).trim();}const quote=String.fromCharCode(34);const apostrophe=String.fromCharCode(39);if((raw.startsWith(quote)&&raw.endsWith(quote))||(raw.startsWith(apostrophe)&&raw.endsWith(apostrophe)))raw=raw.slice(1,-1).trim();try{return raw?new URL(raw).origin:"";}catch{return"";}}
function cfg():DbConfig{const url=normalizeSupabaseUrl(process.env.SUPABASE_URL);const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key};}
function h(key:string){return{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};}
async function db(path:string,init:RequestInit={}){const c=cfg();const r=await fetch(`${c.url}/rest/v1/${path}`,{...init,cache:"no-store",headers:{...h(c.key),...(init.headers||{})}});if(!r.ok)throw new Error(`WORLD_MODEL_DB_${r.status}`);return r;}
function canonical(v:unknown):string{if(v===null||typeof v!=="object")return JSON.stringify(v);if(Array.isArray(v))return `[${v.map(canonical).join(",")}]`;return `{${Object.keys(v as Record<string,unknown>).sort().map(k=>JSON.stringify(k)+":"+canonical((v as Record<string,unknown>)[k])).join(",")}}`;}
export function worldClaimFreshness(claim:{status:string;valid_until?:string|null;confidence?:number|null},now=Date.now()):WorldKnowledgeStatus{if(claim.status==="CONTRADICTORY")return"CONTRADICTORY";if(claim.status==="UNVERIFIED")return"UNVERIFIED";if(claim.valid_until&&new Date(claim.valid_until).getTime()<now)return"STALE";if((claim.confidence??0.5)<0.5)return"KNOWN_WITH_LOW_CONFIDENCE";return"KNOWN";}
const DOMAIN_FIELDS:Record<string,Array<{key:string;label:string;importance:WorldUnknown["importance"];evidence:string[]}>>={business:[
{key:"business.model",label:"business model",importance:"HIGH",evidence:["business model description","pricing or revenue evidence"]},
{key:"business.objectives",label:"business objectives",importance:"HIGH",evidence:["stated objectives or KPI targets"]},
{key:"customer.profile",label:"customer profile",importance:"HIGH",evidence:["customer segments","customer research"]},
{key:"product.offer",label:"product or service offer",importance:"HIGH",evidence:["offer catalogue","pricing"]},
{key:"market.position",label:"market position",importance:"MEDIUM",evidence:["market research","competitor evidence"]},
{key:"sales.performance",label:"sales performance",importance:"HIGH",evidence:["sales metrics","period comparison"]},
{key:"operations.state",label:"operations state",importance:"MEDIUM",evidence:["process metrics","operational observations"]},
{key:"financial.state",label:"financial state",importance:"HIGH",evidence:["revenue/cost/margin data"]},
{key:"risk.profile",label:"risk profile",importance:"HIGH",evidence:["risk register","incident evidence"]},
{key:"kpi.baseline",label:"KPI baseline",importance:"HIGH",evidence:["current KPI measurements"]}]};
function requiredFields(domain:string){return DOMAIN_FIELDS[domain]??[];}
export async function upsertWorldClaim(input:{tenantId:string;subjectKey:string;predicate:string;objectValue:unknown;domain?:string;confidence?:number;source?:string;sourceRef?:string;observedAt?:string;validUntil?:string;valueType?:string;metadata?:Record<string,unknown>}){
 const c=cfg();const u=new URL(`${c.url}/rest/v1/ce_world_claims`);u.searchParams.set("tenant_id",`eq.${input.tenantId}`);u.searchParams.set("subject_key",`eq.${input.subjectKey}`);u.searchParams.set("predicate",`eq.${input.predicate}`);u.searchParams.set("status","in.(ACTIVE,UNVERIFIED,CONTRADICTORY)");u.searchParams.set("select","*");u.searchParams.set("order","created_at.desc");u.searchParams.set("limit","50");
 const lr=await fetch(u,{headers:h(c.key),cache:"no-store"});if(!lr.ok)throw new Error(`WORLD_MODEL_LOOKUP_${lr.status}`);const existing=await lr.json() as WorldClaim[];const same=existing.find(x=>canonical(x.object_value)===canonical(input.objectValue));if(same)return{mode:"UNCHANGED",claim:same,contradictions:[]};
 const r=await db("ce_world_claims",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({tenant_id:input.tenantId,subject_key:input.subjectKey,predicate:input.predicate,object_value:input.objectValue,value_type:input.valueType??"JSON",domain:input.domain??null,confidence:input.confidence??null,source:input.source??null,source_ref:input.sourceRef??null,observed_at:input.observedAt??new Date().toISOString(),valid_until:input.validUntil??null,metadata:input.metadata??{}})});
 const claim=(await r.json() as WorldClaim[])[0];const contradictions:WorldContradiction[]=[];
 for(const other of existing){
   const pr=await db("ce_world_contradictions",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({tenant_id:input.tenantId,subject_key:input.subjectKey,predicate:input.predicate,claim_a_id:other.id,claim_b_id:claim.id,conflict_type:"VALUE_MISMATCH",status:"OPEN",metadata:{detectedBy:"M10.2",sourceA:other.source,sourceB:claim.source}})});
   contradictions.push(...await pr.json() as WorldContradiction[]);
   await db(`ce_world_claims?id=in.(${other.id},${claim.id})`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"CONTRADICTORY"})});
 }
 return{mode:contradictions.length?"CONTRADICTORY":"NEW",claim,contradictions};
}
export async function resolveWorldContradiction(input:{tenantId:string;contradictionId:string;winningClaimId?:string;resolution:string;status?:"RESOLVED"|"ACCEPTED_AS_UNCERTAIN"|"DISMISSED"}){
 const status=input.status??(input.winningClaimId?"RESOLVED":"ACCEPTED_AS_UNCERTAIN");
 await db(`ce_world_contradictions?id=eq.${input.contradictionId}&tenant_id=eq.${input.tenantId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status,resolution:input.resolution.slice(0,4000),winning_claim_id:input.winningClaimId??null,resolved_at:new Date().toISOString()})});
 if(input.winningClaimId&&status==="RESOLVED")await db(`ce_world_claims?id=eq.${input.winningClaimId}&tenant_id=eq.${input.tenantId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"ACTIVE"})});
 return{ok:true,status};
}
export async function detectWorldUnknowns(input:{tenantId:string;domain:string;claims:WorldClaim[]}){
 const fields=requiredFields(input.domain);const present=new Set(input.claims.map(c=>c.subject_key==="business"?c.predicate:`${c.subject_key}.${c.predicate}`));const out:WorldUnknown[]=[];
 for(const f of fields)if(!present.has(f.key)&&!present.has(f.key.replace(/^business\./,""))){
   const u=new URL(`${cfg().url}/rest/v1/ce_world_unknowns`);u.searchParams.set("tenant_id",`eq.${input.tenantId}`);u.searchParams.set("domain",`eq.${input.domain}`);u.searchParams.set("key",`eq.${f.key}`);u.searchParams.set("select","*");const er=await fetch(u,{headers:h(cfg().key),cache:"no-store"});const ex=await er.json() as WorldUnknown[];
   if(ex[0]){out.push(ex[0]);continue;}
   const rr=await db("ce_world_unknowns",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({tenant_id:input.tenantId,domain:input.domain,question:`What is the current ${f.label}?`,key:f.key,importance:f.importance,status:"OPEN",evidence_needed:f.evidence,discovered_from:{detector:"M10.2"},confidence:0})});out.push((await rr.json() as WorldUnknown[])[0]);
 }
 return out;
}
export async function buildWorldState(input:{tenantId:string;domain?:string;persistSnapshot?:boolean}):Promise<WorldState>{
 const domain=input.domain??"business";const c=cfg();const cu=new URL(`${c.url}/rest/v1/ce_world_claims`);cu.searchParams.set("tenant_id",`eq.${input.tenantId}`);cu.searchParams.set("domain",`eq.${domain}`);cu.searchParams.set("status","in.(ACTIVE,UNVERIFIED,CONTRADICTORY)");cu.searchParams.set("select","*");cu.searchParams.set("order","observed_at.desc,created_at.desc");cu.searchParams.set("limit","500");
 const eu=new URL(`${c.url}/rest/v1/ce_world_entities`);eu.searchParams.set("tenant_id",`eq.${input.tenantId}`);eu.searchParams.set("status","eq.ACTIVE");eu.searchParams.set("select","id,entity_type,canonical_name,confidence,status");
 const xu=new URL(`${c.url}/rest/v1/ce_world_contradictions`);xu.searchParams.set("tenant_id",`eq.${input.tenantId}`);xu.searchParams.set("status","in.(OPEN,ACCEPTED_AS_UNCERTAIN)");xu.searchParams.set("select","*");
 const [cr,er,xr]=await Promise.all([fetch(cu,{headers:h(c.key),cache:"no-store"}),fetch(eu,{headers:h(c.key),cache:"no-store"}),fetch(xu,{headers:h(c.key),cache:"no-store"})]);if(!cr.ok||!er.ok||!xr.ok)throw new Error("WORLD_MODEL_READ_FAILED");
 const claims=await cr.json() as WorldClaim[];const entities=await er.json() as WorldState["entities"];const contradictions=await xr.json() as WorldContradiction[];const unknowns=await detectWorldUnknowns({tenantId:input.tenantId,domain,claims});
 const facts:WorldState["facts"]={};for(const claim of claims){const key=claim.subject_key==="business"?claim.predicate:`${claim.subject_key}.${claim.predicate}`;const status=worldClaimFreshness(claim);const prev=facts[key];if(!prev||(claim.confidence??0) > prev.confidence)facts[key]={value:claim.object_value,status,confidence:claim.confidence??0.5,source:claim.source,observedAt:claim.observed_at,claimId:claim.id};}
 const staleClaims=claims.filter(c=>worldClaimFreshness(c)==="STALE");const knownCount=Object.values(facts).filter(f=>f.status==="KNOWN"||f.status==="KNOWN_WITH_LOW_CONFIDENCE").length;const expected=Math.max(requiredFields(domain).length,Object.keys(facts).length+unknowns.length);const completeness=expected?Math.min(1,knownCount/expected):1;const confidence=Object.keys(facts).length?Object.values(facts).reduce((a,f)=>a+f.confidence,0)/Object.keys(facts).length:0;
 const state:WorldState={tenantId:input.tenantId,domain,generatedAt:new Date().toISOString(),modelVersion:"m10.2",completeness,confidence,facts,entities,unknowns,contradictions,staleClaims,claims};
 if(input.persistSnapshot)await db("ce_world_state_snapshots",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({tenant_id:input.tenantId,domain,state,completeness,confidence,claim_count:claims.length,unknown_count:unknowns.length,contradiction_count:contradictions.length,model_version:"m10.2"})});
 return state;
}
export type WorldContext={claims:WorldClaim[];unknowns:WorldUnknown[];contradictions:WorldContradiction[]};
function scoped(path:string,params:Record<string,string>){const c=cfg();const u=new URL(`${c.url}/rest/v1/${path}`);for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);return u;}
async function read<T>(url:URL,errorCode:string):Promise<T>{const r=await fetch(url,{headers:h(cfg().key),cache:"no-store"});if(!r.ok)throw new Error(errorCode);return r.json() as Promise<T>;}
export async function upsertWorldEntity(input:{tenantId:string;entityType:string;canonicalName:string;attributes?:Record<string,unknown>;confidence?:number;source?:string;sourceRef?:string}){
 const r=await db(`ce_world_entities?on_conflict=tenant_id,entity_type,canonical_name`,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({tenant_id:input.tenantId,entity_type:input.entityType,canonical_name:input.canonicalName,attributes:input.attributes??{},confidence:input.confidence??null,source:input.source??null,source_ref:input.sourceRef??null,observed_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
 const rows=await r.json() as Array<Record<string,unknown>>;return rows[0];
}
export async function addWorldClaim(input:{tenantId:string;subjectKey:string;predicate:string;objectValue:unknown;domain?:string;confidence?:number;source?:string;sourceRef?:string;observedAt?:string;validUntil?:string;subjectEntityId?:string;valueType?:string}){
 const result=await upsertWorldClaim({tenantId:input.tenantId,subjectKey:input.subjectKey,predicate:input.predicate,objectValue:input.objectValue,domain:input.domain,confidence:input.confidence,source:input.source,sourceRef:input.sourceRef,observedAt:input.observedAt,validUntil:input.validUntil,valueType:input.valueType,metadata:input.subjectEntityId?{subjectEntityId:input.subjectEntityId}:undefined});
 return result;
}
export async function openWorldUnknown(input:{tenantId:string;domain:string;question:string;key?:string;importance?:WorldUnknown["importance"];evidenceNeeded?:unknown[];discoveredFrom?:Record<string,unknown>;confidence?:number}){
 const key=input.key??unknownKeyFromQuestion(input.question);
 const r=await db("ce_world_unknowns?on_conflict=tenant_id,domain,key",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({tenant_id:input.tenantId,domain:input.domain,question:input.question,key,importance:input.importance??"MEDIUM",status:"OPEN",evidence_needed:input.evidenceNeeded??[],discovered_from:input.discoveredFrom??{collector:"CORE_ENGINE"},confidence:input.confidence??null,updated_at:new Date().toISOString()})});
 const rows=await r.json() as WorldUnknown[];return rows[0];
}
export async function resolveWorldUnknown(input:{tenantId:string;unknownId:string;claimId:string}){
 const r=await db(`ce_world_unknowns?id=eq.${input.unknownId}&tenant_id=eq.${input.tenantId}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"RESOLVED",resolved_by_claim_id:input.claimId,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
 const rows=await r.json() as WorldUnknown[];if(!rows[0])throw new Error("WORLD_UNKNOWN_NOT_FOUND");return rows[0];
}
export async function getWorldContext(input:{tenantId:string;domain?:string;limit?:number}):Promise<WorldContext>{
 const limit=worldContextLimit(input.limit);
 const claimParams:Record<string,string>={tenant_id:`eq.${input.tenantId}`,status:"in.(ACTIVE,UNVERIFIED,CONTRADICTORY)",select:"*",order:"observed_at.desc,created_at.desc",limit:String(limit)};
 const unknownParams:Record<string,string>={tenant_id:`eq.${input.tenantId}`,status:"eq.OPEN",select:"*",order:"created_at.desc",limit:String(limit)};
 const contradictionParams:Record<string,string>={tenant_id:`eq.${input.tenantId}`,status:"in.(OPEN,ACCEPTED_AS_UNCERTAIN)",select:"*",order:"detected_at.desc",limit:String(limit)};
 if(input.domain){claimParams.domain=`eq.${input.domain}`;unknownParams.domain=`eq.${input.domain}`;}
 const [claims,unknowns,contradictions]=await Promise.all([
  read<WorldClaim[]>(scoped("ce_world_claims",claimParams),"WORLD_MODEL_CLAIMS_READ_FAILED"),
  read<WorldUnknown[]>(scoped("ce_world_unknowns",unknownParams),"WORLD_MODEL_UNKNOWNS_READ_FAILED"),
  read<WorldContradiction[]>(scoped("ce_world_contradictions",contradictionParams),"WORLD_MODEL_CONTRADICTIONS_READ_FAILED")]);
 return{claims,unknowns,contradictions};
}
export async function buildWorldSnapshot(input:{tenantId:string;domain:string;goals?:unknown[];constraints?:unknown[];priorities?:unknown[];activeHypotheses?:unknown[]}){
 const state=await buildWorldState({tenantId:input.tenantId,domain:input.domain,persistSnapshot:true});
 return{...state,context:{goals:input.goals??[],constraints:input.constraints??[],priorities:input.priorities??[],activeHypotheses:input.activeHypotheses??[]}};
}