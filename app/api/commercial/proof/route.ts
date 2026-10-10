import { authorizeTenant } from "@/lib/http";
import {NextResponse} from "next/server";
import {missions,events} from "@/lib/engine";
import {storageMode,listPersistedMissions,listPersistedEvents} from "@/lib/storage";
import {resolveSaaSContext} from "@/lib/saas-runtime";
import {tenantMissionIds,listValueCases,getBillingEvidence,getTenantCreatedAt} from "@/lib/commercial-storage";
import {buildMissionReport,type ReportEvent} from "@/lib/mission-report";
import {buildCommercialProofMetrics} from "@/lib/commercial-proof";

export async function GET(request:Request){
  const auth = await authorizeTenant(request); if (!auth.ok) return auth.response;
 try{
  const runtime=await resolveSaaSContext(request);
  const tenant=runtime.identity?{tenantId:runtime.identity.tenantId}:runtime.legacyTenant!;
  const ids=new Set(await tenantMissionIds(tenant.tenantId));
  if(storageMode()==="supabase"){
   const [allMissions,allEvents,valueCases,billing,tenantCreatedAt]=await Promise.all([listPersistedMissions(100),listPersistedEvents(500),listValueCases(tenant.tenantId,100),getBillingEvidence(tenant.tenantId),getTenantCreatedAt(tenant.tenantId)]);
   const tenantMissions=allMissions.filter(m=>ids.has(m.id));
   const reportEvents:ReportEvent[]=allEvents.filter(e=>ids.has(e.missionId)).map(x=>({id:x.id,missionId:x.missionId,eventType:x.eventType,createdAt:x.createdAt,metadata:x.metadata,decisionId:x.decisionId??undefined,fromState:x.fromState??undefined,toState:x.toState??undefined,actorType:x.actorType}));
   const reports=tenantMissions.map(m=>buildMissionReport({mission:m,events:reportEvents,tenantId:tenant.tenantId}));
   return NextResponse.json({ok:true,metrics:buildCommercialProofMetrics({missions:tenantMissions,events:reportEvents,reports,valueCases:valueCases.items,billing,tenantCreatedAt}),persistence:"supabase",durable:true});
  }
  const tenantMissions=[...missions.values()].filter(m=>ids.has(m.id));
  const valueCases=await listValueCases(tenant.tenantId,100);
  const billing=await getBillingEvidence(tenant.tenantId);
  const reports=tenantMissions.map(m=>buildMissionReport({mission:m,events,tenantId:tenant.tenantId}));
  return NextResponse.json({ok:true,metrics:buildCommercialProofMetrics({missions:tenantMissions,events,reports,valueCases:valueCases.items,billing}),persistence:"in-memory-runtime",durable:false});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:"COMMERCIAL_PROOF_FAILED"},{status:503});
 }
}
