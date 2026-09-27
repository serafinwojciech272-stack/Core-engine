type DbConfig={url:string;key:string};
type Importance="LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
function cfg():DbConfig{const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key};}
function headers(key:string){return{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};}
async function db(path:string,init:RequestInit={}){const c=cfg();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(c.url+"/rest/v1/"+path,{...init,cache:"no-store",signal:controller.signal,headers:{...headers(c.key),...(init.headers||{})}});if(!r.ok)throw new Error("WORLD_MODEL_DB_"+r.status);return r;}finally{clearTimeout(timer);}}
function norm(v:string){return v.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ").slice(0,500);}
function same(a:unknown,b:unknown){try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}}
export async function upsertWorldEntity(input:{tenantId:string;entityType:string;canonicalName:string;attributes?:Record<string,unknown>;confidence?:number;source?:string;sourceRef?:string}){
 const c=cfg();const url=new URL(c.url+"/rest/v1/ce_world_entities");url.searchParams.set("on_conflict","tenant_id,entity_type,canonical_name");
 const r=await db(url.pathname.slice(1)+url.search,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({tenant_id:input.tenantId,entity_type:input.entityType,canonical_name:input.canonicalName.slice(0,500),attributes:input.attributes??{},confidence:input.confidence??null,source:input.source??"CORE_ENGINE",source_ref:input.sourceRef??null,updated_at:new Date().toISOString()})});
 const rows=await r.json() as unknown[];return rows[0]??null;
}
export async function addWorldClaim(input:{tenantId:string;subjectKey:string;predicate:string;objectValue:unknown;domain?:string;confidence?:number;source?:string;sourceRef?:string;observedAt?:string;validUntil?:string;subjectEntityId?:string}){
 const c=cfg();const lookup=new URL(c.url+"/rest/v1/ce_world_claims");
 lookup.searchParams.set("tenant_id","eq."+input.tenantId);lookup.searchParams.set("subject_key","eq."+input.subjectKey);lookup.searchParams.set("predicate","eq."+input.predicate);lookup.searchParams.set("status","eq.ACTIVE");lookup.searchParams.set("select","id,object_value,confidence,source,source_ref,observed_at");
 const existingR=await fetch(lookup,{headers:headers(c.key),cache:"no-store"});if(!existingR.ok)throw new Error("WORLD_CLAIMS_LOOKUP_"+existingR.status);
 const existing=await existingR.json() as Array<Record<string,unknown>>;
 const conflict=existing.find(x=>!same(x.object_value,input.objectValue));
 const r=await db("ce_world_claims",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({tenant_id:input.tenantId,subject_entity_id:input.subjectEntityId??null,subject_key:input.subjectKey.slice(0,500),predicate:input.predicate.slice(0,500),object_value:input.objectValue,value_type:"JSON",domain:input.domain??null,confidence:input.confidence??null,source:input.source??"CORE_ENGINE",source_ref:input.sourceRef??null,observed_at:input.observedAt??null,valid_until:input.validUntil??null})});
 const rows=await r.json() as unknown[];const claim=rows[0] as Record<string,unknown>|undefined;
 if(claim&&conflict){
   const cr=await db("ce_world_contradictions",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({tenant_id:input.tenantId,subject_key:input.subjectKey,predicate:input.predicate,claim_a_id:conflict.id,claim_b_id:claim.id,conflict_type:"VALUE_MISMATCH",status:"OPEN",confidence:Math.min(Number(conflict.confidence??.5),Number(input.confidence??.5)),metadata:{detected_by:"M10.2"}})});
   await db("ce_world_claims?id=in.("+String(conflict.id)+","+String(claim.id)+")",{method:"PATCH",body:JSON.stringify({status:"CONTRADICTORY",updated_at:new Date().toISOString()})});
   const contradictions=await cr.json() as unknown[];return{claim,contradiction:contradictions[0]??null};
 }
 return{claim,contradiction:null};
}
export async function openWorldUnknown(input:{tenantId:string;domain:string;question:string;key?:string;importance?:Importance;evidenceNeeded?:unknown[];discoveredFrom?:Record<string,unknown>;confidence?:number}){
 const c=cfg();const key=input.key??norm(input.question);const url=new URL(c.url+"/rest/v1/ce_world_unknowns");url.searchParams.set("on_conflict","tenant_id,domain,key");
 const r=await db(url.pathname.slice(1)+url.search,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({tenant_id:input.tenantId,domain:input.domain,question:input.question.slice(0,12000),key,importance:input.importance??"MEDIUM",status:"OPEN",evidence_needed:input.evidenceNeeded??[],discovered_from:input.discoveredFrom??{},confidence:input.confidence??null,updated_at:new Date().toISOString()})});
 const rows=await r.json() as unknown[];return rows[0]??null;
}
export async function resolveWorldUnknown(input:{tenantId:string;unknownId:string;claimId:string}){
 const url=new URL(cfg().url+"/rest/v1/ce_world_unknowns");url.searchParams.set("tenant_id","eq."+input.tenantId);url.searchParams.set("id","eq."+input.unknownId);
 const r=await db(url.pathname.slice(1)+url.search,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"RESOLVED",resolved_by_claim_id:input.claimId,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
 const rows=await r.json() as unknown[];return rows[0]??null;
}
export async function getWorldContext(input:{tenantId:string;domain?:string;limit?:number}){
 const c=cfg();const limit=Math.max(1,Math.min(input.limit??50,100));const claimsUrl=new URL(c.url+"/rest/v1/ce_world_claims");
 claimsUrl.searchParams.set("tenant_id","eq."+input.tenantId);claimsUrl.searchParams.set("status","eq.ACTIVE");claimsUrl.searchParams.set("select","id,subject_key,predicate,object_value,domain,confidence,source,source_ref,observed_at,valid_until,updated_at");claimsUrl.searchParams.set("order","updated_at.desc");claimsUrl.searchParams.set("limit",String(limit));
 const unknownUrl=new URL(c.url+"/rest/v1/ce_world_unknowns");unknownUrl.searchParams.set("tenant_id","eq."+input.tenantId);unknownUrl.searchParams.set("status","eq.OPEN");unknownUrl.searchParams.set("select","id,domain,question,key,importance,status,evidence_needed,confidence,created_at");unknownUrl.searchParams.set("order","importance.desc,created_at.asc");unknownUrl.searchParams.set("limit","50");
 const contraUrl=new URL(c.url+"/rest/v1/ce_world_contradictions");contraUrl.searchParams.set("tenant_id","eq."+input.tenantId);contraUrl.searchParams.set("status","eq.OPEN");contraUrl.searchParams.set("select","id,subject_key,predicate,claim_a_id,claim_b_id,conflict_type,confidence,detected_at");contraUrl.searchParams.set("order","detected_at.desc");contraUrl.searchParams.set("limit","50");
 const [a,b,d]=await Promise.all([fetch(claimsUrl,{headers:headers(c.key)}),fetch(unknownUrl,{headers:headers(c.key)}),fetch(contraUrl,{headers:headers(c.key)})]);
 if(!a.ok||!b.ok||!d.ok)throw new Error("WORLD_CONTEXT_READ_FAILED");
 let claims=await a.json() as Array<Record<string,unknown>>;const unknowns=await b.json();const contradictions=await d.json();
 if(input.domain)claims=claims.filter(x=>x.domain===input.domain);
 const now=Date.now();claims=claims.filter(x=>!x.valid_until||new Date(String(x.valid_until)).getTime()>=now);
 return{claims,unknowns,contradictions};
}
export async function buildWorldSnapshot(input:{tenantId:string;domain:string;goals?:unknown[];constraints?:unknown[];priorities?:unknown[];activeHypotheses?:unknown[]}){
 const context=await getWorldContext({tenantId:input.tenantId,domain:input.domain,limit:100});
 const claimConfidence=context.claims.length?context.claims.reduce((s,x)=>s+Number(x.confidence??.5),0)/context.claims.length:0;
 const completeness=Math.max(0,Math.min(1,context.claims.length/(context.claims.length+context.unknowns.length+context.contradictions.length+1)));
 const state={goals:input.goals??[],constraints:input.constraints??[],priorities:input.priorities??[],activeHypotheses:input.activeHypotheses??[],claims:context.claims,unknowns:context.unknowns,contradictions:context.contradictions};
 const r=await db("ce_world_state_snapshots",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({tenant_id:input.tenantId,domain:input.domain,state,completeness,confidence:claimConfidence,claim_count:context.claims.length,unknown_count:context.unknowns.length,contradiction_count:context.contradictions.length,model_version:"m10.2"})});
 const rows=await r.json() as unknown[];return rows[0]??null;
}