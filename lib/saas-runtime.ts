import { resolveTenant, type TenantContext } from "@/lib/commercial-runtime";

type SupabaseConfig={url:string; serviceKey:string; publishableKey:string};
export type SaaSIdentity={userId:string; email:string|null; tenantId:string; tenantKey:string; tenantName:string; workspaceId:string; workspaceSlug:string; role:"owner"|"admin"|"member"|"viewer"};

function normalizeSupabaseUrl(value:string|undefined){let raw=(value||"").trim();if(raw.toUpperCase().startsWith("SUPABASE_URL")){const i=raw.indexOf("=");if(i>=0)raw=raw.slice(i+1).trim();}const quote=String.fromCharCode(34);const apostrophe=String.fromCharCode(39);if((raw.startsWith(quote)&&raw.endsWith(quote))||(raw.startsWith(apostrophe)&&raw.endsWith(apostrophe)))raw=raw.slice(1,-1).trim();try{return raw?new URL(raw).origin:"";}catch{return"";}}
function cfg():SupabaseConfig|null{
  const url=normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||"";
  return url&&serviceKey&&publishableKey?{url,serviceKey,publishableKey}:null;
}
async function req(url:string,init:RequestInit={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  try{return await fetch(url,{...init,cache:"no-store",signal:controller.signal})}finally{clearTimeout(timer)}
}
function serviceHeaders(key:string){return{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"}}
function userHeaders(key:string,token:string){return{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json"}}

async function authenticatedUser(request:Request){
  const c=cfg();const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  if(!c||!token)return null;
  const response=await req(c.url+"/auth/v1/user",{headers:userHeaders(c.publishableKey,token)});
  if(!response.ok)return null;
  const user=await response.json() as {id?:string;email?:string};
  return user.id?{id:user.id,email:user.email??null}:null;
}

async function queryMembership(c:SupabaseConfig,userId:string){
  const url=new URL(c.url+"/rest/v1/ce_tenant_members");
  url.searchParams.set("user_id","eq."+userId);url.searchParams.set("select","tenant_id,role,ce_tenants(id,external_key,name,active)");
  url.searchParams.set("limit","1");
  const response=await req(url.toString(),{headers:serviceHeaders(c.serviceKey)});
  if(!response.ok)throw new Error("SAAS_MEMBERSHIP_READ_"+response.status);
  const rows=await response.json() as Array<{tenant_id:string;role:SaaSIdentity["role"];ce_tenants:{id:string;external_key:string;name:string;active:boolean}|null}>;
  return rows[0]||null;
}

async function provision(c:SupabaseConfig,userId:string,email:string|null){
  const existing=await queryMembership(c,userId);if(existing?.ce_tenants?.active){
    const ws=await workspaceForUser(c,existing.tenant_id,userId);
    if(ws)return {tenant:existing.ce_tenants,role:existing.role,workspace:ws};
  }
  const tenantId=crypto.randomUUID();const tenantKey="user:"+userId;const name=email?email.split("@")[0]+" Workspace":"My Organization";
  const tenantResponse=await req(c.url+"/rest/v1/ce_tenants?on_conflict=external_key",{method:"POST",headers:{...serviceHeaders(c.serviceKey),Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({id:tenantId,external_key:tenantKey,name,active:true})});
  if(!tenantResponse.ok)throw new Error("SAAS_TENANT_CREATE_"+tenantResponse.status);
  const tenantRows=await tenantResponse.json() as Array<{id:string;external_key:string;name:string;active:boolean}>;
  const tenant=tenantRows[0]||{id:tenantId,external_key:tenantKey,name,active:true};
  await req(c.url+"/rest/v1/ce_tenant_members?on_conflict=tenant_id,user_id",{method:"POST",headers:{...serviceHeaders(c.serviceKey),Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({tenant_id:tenant.id,user_id:userId,role:"owner"})}).then(async r=>{if(!r.ok)throw new Error("SAAS_MEMBER_CREATE_"+r.status)});
  const workspaceId=crypto.randomUUID();
  const ws=await req(c.url+"/rest/v1/ce_workspaces?on_conflict=tenant_id,slug",{method:"POST",headers:{...serviceHeaders(c.serviceKey),Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({id:workspaceId,tenant_id:tenant.id,slug:"main",name:"Main Workspace",active:true})});
  if(!ws.ok)throw new Error("SAAS_WORKSPACE_CREATE_"+ws.status);
  const workspaces=await ws.json() as Array<{id:string;slug:string;name:string;active:boolean}>;
  const workspace=workspaces[0]||{id:workspaceId,slug:"main",name:"Main Workspace",active:true};
  await req(c.url+"/rest/v1/ce_workspace_members?on_conflict=workspace_id,user_id",{method:"POST",headers:{...serviceHeaders(c.serviceKey),Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({workspace_id:workspace.id,user_id:userId,role:"admin"})}).then(async r=>{if(!r.ok)throw new Error("SAAS_WORKSPACE_MEMBER_CREATE_"+r.status)});
  await req(c.url+"/rest/v1/ce_billing_accounts?on_conflict=tenant_id",{method:"POST",headers:{...serviceHeaders(c.serviceKey),Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({tenant_id:tenant.id,plan:"free",status:"active",monthly_unit_limit:100,provider:"internal"})}).then(async r=>{if(!r.ok)throw new Error("SAAS_BILLING_CREATE_"+r.status)});
  return {tenant,role:"owner" as const,workspace};
}

async function workspaceForUser(c:SupabaseConfig,tenantId:string,userId:string){
  const url=new URL(c.url+"/rest/v1/ce_workspace_members");
  url.searchParams.set("user_id","eq."+userId);url.searchParams.set("select","role,ce_workspaces(id,slug,name,active,tenant_id)");
  url.searchParams.set("limit","1");
  const response=await req(url.toString(),{headers:serviceHeaders(c.serviceKey)});
  if(!response.ok)throw new Error("SAAS_WORKSPACE_READ_"+response.status);
  const rows=await response.json() as Array<{role:"admin"|"member"|"viewer";ce_workspaces:{id:string;slug:string;name:string;active:boolean;tenant_id:string}|null}>;
  const row=rows.find(x=>x.ce_workspaces?.tenant_id===tenantId&&x.ce_workspaces.active);
  return row?{...row.ce_workspaces,role:row.role}:null;
}

export async function resolveSaaSContext(request:Request):Promise<{identity:SaaSIdentity|null;legacyTenant:TenantContext|null}>{
  const user=await authenticatedUser(request);
  const c=cfg();
  if(user&&c){
    const membership=await queryMembership(c,user.id);
    const provisioned=membership?.ce_tenants?.active?{tenant:membership.ce_tenants,role:membership.role,workspace:await workspaceForUser(c,membership.tenant_id,user.id)}:await provision(c,user.id,user.email);
    const workspace=provisioned.workspace;
    const tenantRecord=provisioned.tenant;
    if(!workspace||!tenantRecord)throw new Error("SAAS_ORGANIZATION_NOT_FOUND");
    return {identity:{userId:user.id,email:user.email??null,tenantId:String(tenantRecord.id),tenantKey:String(tenantRecord.external_key),tenantName:String(tenantRecord.name),workspaceId:String(workspace.id),workspaceSlug:String(workspace.slug),role:provisioned.role},legacyTenant:null};
  }
  try {
    return {identity:null,legacyTenant:resolveTenant(request)};
  } catch (error) {
    if (error instanceof Error && error.message === "TENANT_NOT_CONFIGURED" && process.env.CORE_ENGINE_ALLOW_ANONYMOUS === "true") {
      return {identity:null,legacyTenant:{tenantId:"09e12da8-24a5-5bfa-b2b4-c8d1d04aa0af",tenantKey:"public-demo"}};
    }
    throw error;
  }
}

export async function consumeSaaSUsage(tenantId:string,units:number){
  const c=cfg();if(!c)return{allowed:true,used:0,limit:null,status:"local"};
  const response=await req(c.url+"/rest/v1/rpc/ce_consume_usage",{method:"POST",headers:{...serviceHeaders(c.serviceKey),Prefer:"return=representation"},body:JSON.stringify({p_tenant_id:tenantId,p_units:units,p_period_start:new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString()})});
  if(!response.ok)throw new Error("SAAS_USAGE_QUOTA_"+response.status);
  const value=await response.json() as {allowed:boolean;used:number;limit:number;status:string};
  return value;
}

export function saasStatus(){
  const c=cfg();return{identityProvider:"supabase-auth",configured:Boolean(c),workspaceMembership:"durable",billing:"internal-plan-v1",usageLimits:"database-enforced"};
}


export async function getSaaSUsage(tenantId:string){
  const c=cfg();if(!c)return{used:0,limit:null,plan:"local",status:"local",periodStart:new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString()};
  const periodStart=new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString();
  const billingUrl=new URL(c.url+"/rest/v1/ce_billing_accounts");billingUrl.searchParams.set("tenant_id","eq."+tenantId);billingUrl.searchParams.set("select","plan,status,monthly_unit_limit,current_period_start,current_period_end");billingUrl.searchParams.set("limit","1");
  const usageUrl=new URL(c.url+"/rest/v1/ce_usage_periods");usageUrl.searchParams.set("tenant_id","eq."+tenantId);usageUrl.searchParams.set("period_start","eq."+periodStart);usageUrl.searchParams.set("select","units_used");usageUrl.searchParams.set("limit","1");
  const [br,ur]=await Promise.all([req(billingUrl.toString(),{headers:serviceHeaders(c.serviceKey)}),req(usageUrl.toString(),{headers:serviceHeaders(c.serviceKey)})]);
  if(!br.ok||!ur.ok)throw new Error("SAAS_USAGE_READ_FAILED");
  const billing=(await br.json() as Array<{plan:string;status:string;monthly_unit_limit:number;current_period_start:string;current_period_end:string}>)[0];
  const usage=(await ur.json() as Array<{units_used:number}>)[0];
  return{used:usage?.units_used??0,limit:billing?.monthly_unit_limit??0,plan:billing?.plan??"free",status:billing?.status??"active",periodStart:billing?.current_period_start??periodStart,periodEnd:billing?.current_period_end??null};
}
