import {NextResponse} from "next/server";
import {missions,events} from "@/lib/engine";
import {storageMode,listPersistedMissions,listPersistedEvents} from "@/lib/storage";
import {resolveSaaSContext} from "@/lib/saas-runtime";
import {tenantMissionIds} from "@/lib/commercial-storage";
import {buildMissionReport,type ReportEvent} from "@/lib/mission-report";
import {buildCommercialProofMetrics} from "@/lib/commercial-proof";

export async function GET(request:Request){
 try{
  const runtime=await resolveSaaSContext(request);
  const tenant=runtime.identity?{tenantId:runtime.identity.tenantId}:runtime.legacyTenant!;
  const ids=new Set(await tenantMissionIds(tenant.tenantId));
  if(storageMode()==="supabase"){
   const [allMissions,allEvents]=await Promise.all([listPersistedMissions(100),listPersistedEvents(500)]);
   const tenantMissions=allMissions.filter(m=>ids.has(m.id));
   const reportEvents:ReportEvent[]=allEvents.filter(e=>ids.has(e.missionId)).map(x=>({id:x.id,missionId:x.missionId,eventType:x.eventType,createdAt:x.createdAt,metadata:x.metadata,decisionId:x.decisionId??undefined,fromState:x.fromState??undefined,toState:x.toState??undefined,actorType:x.actorType}));
   const reports=tenantMissions.map(m=>buildMissionReport({mission:m,events:reportEvents,tenantId:tenant.tenantId}));
   return NextResponse.json({ok:true,metrics:buildCommercialProofMetrics({missions:tenantMissions,events:reportEvents,reports}),persistence:"supabase",durable:true});
  }
  const tenantMissions=[...missions.values()].filter(m=>ids.has(m.id));
  const reports=tenantMissions.map(m=>buildMissionReport({mission:m,events,tenantId:tenant.tenantId}));
  return NextResponse.json({ok:true,metrics:buildCommercialProofMetrics({missions:tenantMissions,events,reports}),persistence:"in-memory-runtime",durable:false});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:"COMMERCIAL_PROOF_FAILED"},{status:503});
 }
}
