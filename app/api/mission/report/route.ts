import {NextResponse} from "next/server";
import {missions,events} from "@/lib/engine";
import {storageMode,listPersistedMissions,listPersistedEvents} from "@/lib/storage";
import {resolveSaaSContext} from "@/lib/saas-runtime";
import {tenantMissionIds} from "@/lib/commercial-storage";
import {buildMissionReport,type ReportEvent} from "@/lib/mission-report";
export async function GET(request:Request){
 const runtime=await resolveSaaSContext(request);const tenant=runtime.identity?{tenantId:runtime.identity.tenantId}:runtime.legacyTenant!;
 const id=new URL(request.url).searchParams.get("id")||"";
 if(!id)return NextResponse.json({ok:false,error:"MISSION_ID_REQUIRED"},{status:400});
 if(storageMode()==="supabase"){
  try{const ids=new Set(await tenantMissionIds(tenant.tenantId));if(!ids.has(id))return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});const [ms,es]=await Promise.all([listPersistedMissions(100),listPersistedEvents(500)]);const mission=ms.find(m=>m.id===id);if(!mission)return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});const reportEvents:ReportEvent[]=es.map(x=>({id:x.id,missionId:x.missionId,eventType:x.eventType,createdAt:x.createdAt,metadata:x.metadata,decisionId:x.decisionId??undefined,fromState:x.fromState??undefined,toState:x.toState??undefined,actorType:x.actorType}));return NextResponse.json({ok:true,report:buildMissionReport({mission,events:reportEvents,tenantId:tenant.tenantId}),persistence:"supabase",durable:true})}catch{return NextResponse.json({ok:false,error:"MISSION_REPORT_FAILED"},{status:503})}
 }
 const mission=missions.get(id);if(!mission)return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});if(!(await tenantMissionIds(tenant.tenantId)).includes(id))return NextResponse.json({ok:false,error:"TENANT_ACCESS_DENIED"},{status:403});
 return NextResponse.json({ok:true,report:buildMissionReport({mission,events,tenantId:tenant.tenantId}),persistence:"in-memory-runtime",durable:false});
}
