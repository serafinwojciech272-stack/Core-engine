import { commercialRuntimeStatus } from "@/lib/commercial-runtime";

type Config = { url: string; key: string };
const memoryMissionTenants = new Map<string, string>();

function cfg(): Config | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function request(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try { return await fetch(url, { ...init, cache: "no-store", signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

function headers(key: string) {
  return { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
}

export async function ensureTenant(tenantId: string, tenantKey: string) {
  const c = cfg();
  if (!c) return { durable: false, tenantId, tenantKey };
  const response = await request(c.url + "/rest/v1/ce_tenants?on_conflict=id", {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: tenantId, external_key: tenantKey, name: tenantKey, active: true })
  });
  if (!response.ok) throw new Error("SUPABASE_TENANT_UPSERT_" + response.status);
  return { durable: true, tenantId, tenantKey };
}

export async function bindMissionTenant(missionId: string, tenantId: string) {
  const c = cfg();
  if (!c) { memoryMissionTenants.set(missionId, tenantId); return true; }
  const response = await request(c.url + "/rest/v1/ce_mission_tenants?on_conflict=mission_id", {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ mission_id: missionId, tenant_id: tenantId })
  });
  if (!response.ok) throw new Error("SUPABASE_MISSION_TENANT_BIND_" + response.status);
  return true;
}

export async function missionBelongsToTenant(missionId: string, tenantId: string) {
  const c = cfg();
  if (!c) return memoryMissionTenants.get(missionId) === tenantId;
  const url = new URL(c.url + "/rest/v1/ce_mission_tenants");
  url.searchParams.set("mission_id", "eq." + missionId);
  url.searchParams.set("tenant_id", "eq." + tenantId);
  url.searchParams.set("select", "mission_id");
  url.searchParams.set("limit", "1");
  const response = await request(url.toString(), { headers: headers(c.key) });
  if (!response.ok) throw new Error("SUPABASE_MISSION_TENANT_READ_" + response.status);
  const rows = await response.json() as Array<{ mission_id: string }>;
  return rows.length === 1;
}

export async function tenantMissionIds(tenantId: string) {
  const c = cfg();
  if (!c) return [...memoryMissionTenants.entries()].filter(([, value]) => value === tenantId).map(([key]) => key);
  const url = new URL(c.url + "/rest/v1/ce_mission_tenants");
  url.searchParams.set("tenant_id", "eq." + tenantId);
  url.searchParams.set("select", "mission_id");
  const response = await request(url.toString(), { headers: headers(c.key) });
  if (!response.ok) throw new Error("SUPABASE_TENANT_MISSIONS_READ_" + response.status);
  return (await response.json() as Array<{ mission_id: string }>).map(x => x.mission_id);
}

export async function recordUsage(tenantId: string, actorId: string, eventType: string, missionId?: string, units = 1, metadata: Record<string, unknown> = {}) {
  const c = cfg();
  if (!c) return { durable: false, counted: true };
  const response = await request(c.url + "/rest/v1/ce_usage_events", {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "return=minimal" },
    body: JSON.stringify({ tenant_id: tenantId, actor_id: actorId, event_type: eventType, mission_id: missionId || null, units, metadata })
  });
  if (!response.ok) throw new Error("SUPABASE_USAGE_EVENT_" + response.status);
  return { durable: true, counted: true };
}

export function commercialRuntimeReadiness() {
  const c = cfg();
  return { ...commercialRuntimeStatus(), persistence: c ? "supabase" : "memory" } as const;
}


import {calculateCommercialValue,type CommercialValueCase} from "@/lib/commercial-value";

const memoryValueCases = new Map<string, CommercialValueCase>();

function mapValueCase(row: Record<string, unknown>): CommercialValueCase {
  const calculated = calculateCommercialValue({
    baselineValue: Number(row.baseline_value),
    targetValue: row.target_value == null ? null : Number(row.target_value),
    actualValue: row.actual_value == null ? null : Number(row.actual_value),
    investmentValue: Number(row.investment_value)
  });
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    missionId: row.mission_id == null ? null : String(row.mission_id),
    name: String(row.name),
    currency: String(row.currency),
    baselineValue: Number(row.baseline_value),
    targetValue: row.target_value == null ? null : Number(row.target_value),
    actualValue: row.actual_value == null ? null : Number(row.actual_value),
    investmentValue: Number(row.investment_value),
    ...calculated,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function createValueCase(input:{
  tenantId:string;
  missionId:string|null;
  name:string;
  currency:string;
  baselineValue:number;
  targetValue:number|null;
  actualValue:number|null;
  investmentValue:number;
}):Promise<CommercialValueCase>{
  const c=cfg();
  if(!c){
    const id=crypto.randomUUID();
    const now=new Date().toISOString();
    const calculated=calculateCommercialValue(input);
    const item:CommercialValueCase={id,...input,...calculated,createdAt:now,updatedAt:now};
    memoryValueCases.set(id,item);
    return item;
  }
  const response=await request(c.url+"/rest/v1/ce_value_cases",{
    method:"POST",
    headers:{...headers(c.key),Prefer:"return=representation"},
    body:JSON.stringify({
      tenant_id:input.tenantId,
      mission_id:input.missionId,
      name:input.name,
      currency:input.currency,
      baseline_value:input.baselineValue,
      target_value:input.targetValue,
      actual_value:input.actualValue,
      investment_value:input.investmentValue,
      updated_at:new Date().toISOString()
    })
  });
  if(!response.ok)throw new Error("SUPABASE_VALUE_CASE_CREATE_"+response.status);
  const rows=await response.json() as Record<string,unknown>[];
  if(!rows[0])throw new Error("SUPABASE_VALUE_CASE_EMPTY");
  return mapValueCase(rows[0]);
}

export async function listValueCases(tenantId:string,limit=50):Promise<{durable:boolean;items:CommercialValueCase[]}>{
  const c=cfg();
  if(!c){
    return {durable:false,items:[...memoryValueCases.values()].filter(x=>x.tenantId===tenantId).slice(-Math.min(50,Math.max(1,limit))).reverse()};
  }
  const url=new URL(c.url+"/rest/v1/ce_value_cases");
  url.searchParams.set("tenant_id","eq."+tenantId);
  url.searchParams.set("select","*");
  url.searchParams.set("order","created_at.desc");
  url.searchParams.set("limit",String(Math.min(100,Math.max(1,limit))));
  const response=await request(url.toString(),{headers:headers(c.key)});
  if(!response.ok)throw new Error("SUPABASE_VALUE_CASE_READ_"+response.status);
  const rows=await response.json() as Record<string,unknown>[];
  return {durable:true,items:rows.map(mapValueCase)};
}


export type CommercialBillingEvidence={
  configured:boolean;
  provider:string|null;
  plan:string|null;
  status:string|null;
  externalSubscriptionIdPresent:boolean;
  subscriptionActive:boolean;
};

export async function getBillingEvidence(tenantId:string):Promise<CommercialBillingEvidence>{
  const c=cfg();
  if(!c)return {configured:false,provider:null,plan:null,status:null,externalSubscriptionIdPresent:false,subscriptionActive:false};
  const url=new URL(c.url+"/rest/v1/ce_billing_accounts");
  url.searchParams.set("tenant_id","eq."+tenantId);
  url.searchParams.set("select","provider,plan,status,external_subscription_id");
  url.searchParams.set("limit","1");
  const response=await request(url.toString(),{headers:headers(c.key)});
  if(!response.ok)throw new Error("SUPABASE_BILLING_EVIDENCE_READ_"+response.status);
  const rows=await response.json() as Array<Record<string,unknown>>;
  const row=rows[0];
  if(!row)return {configured:false,provider:null,plan:null,status:null,externalSubscriptionIdPresent:false,subscriptionActive:false};
  const subscriptionPresent=typeof row.external_subscription_id==="string"&&row.external_subscription_id.length>0;
  const status=String(row.status);
  return {
    configured:true,
    provider:String(row.provider),
    plan:String(row.plan),
    status,
    externalSubscriptionIdPresent:subscriptionPresent,
    subscriptionActive:subscriptionPresent&&(status==="active"||status==="trialing")
  };
}
