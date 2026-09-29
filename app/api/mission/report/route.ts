import {NextResponse} from "next/server";
import {missions,events,type Mission, type EngineEvent} from "@/lib/engine";
import {storageMode,listPersistedMissions,listPersistedEvents,type EngineEventRow} from "@/lib/storage";
import {resolveSaaSContext} from "@/lib/saas-runtime";
import {tenantMissionIds} from "@/lib/commercial-storage";
import {buildMissionReport,type ReportEvent} from "@/lib/mission-report";
function toReportEvent(event:EngineEventRow|EngineEvent):ReportEvent{return{id:event.id,missionId:event.missionId,eventType:event.eventType,createdAt:event.createdAt,metadata:"metadata" in event?event.metadata:undefined,decisionId:event.decisionId??undefined,fromState:event.fromState??undefined,toState:event.toState??undefined,actorType:event.actorType}}
export async function GET(request:Request){
 const runtime=await resolveSaaSContext(request);const tenant=runtime.identity?{tenantId:runtime.identity.tenantId}:runtime.legacyTenant!;
 const id=new URL(request.url).searchParams.get("id")||"";if(!id)return NextResponse.json({ok:false,error:"MISSION_ID_REQUIRED"},{status:400});
 if(storageMode()==="supabase"){try{const ids=new Set(await tenantMissionIds(tenant.tenantId));if(!ids.has(id))return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});const [persistedMissions,persistedEvents]=await Promise.all([listPersistedMissions(100),listPersistedEvents(500)]);const mission=persistedMissions.find(item=>item.id===id);if(!mission)return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});return NextResponse.json({ok:true,report:buildMissionReport({mission,events:persistedEvents.map(toReportEvent),tenantId:tenant.tenantId}),persistence:"supabase",durable:true})}catch{return NextResponse.json({ok:false,error:"MISSION_REPORT_FAILED"},{status:503})}}
 const mission=missions.get(id) as Mission|undefined;if(!mission)return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});if(!(await tenantMissionIds(tenant.tenantId)).includes(id))return NextResponse.json({ok:false,error:"TENANT_ACCESS_DENIED"},{status:403});return NextResponse.json({ok:true,report:buildMissionReport({mission,events:events.map(toReportEvent),tenantId:tenant.tenantId}),persistence:"in-memory-runtime",durable:false})
}