import {NextResponse} from "next/server";
import {storageMode,listPersistedMissions,listPersistedEvents} from "@/lib/storage";
import {missions,events} from "@/lib/engine";
import {resolveSaaSContext} from "@/lib/saas-runtime";
import {tenantMissionIds} from "@/lib/commercial-storage";
import {calculateCommercialMetrics} from "@/lib/commercial-metrics";
export async function GET(request:Request){
 const runtime=await resolveSaaSContext(request);const tenantId=runtime.identity?.tenantId??runtime.legacyTenant?.tenantId;if(!tenantId)return NextResponse.json({ok:false,error:"TENANT_REQUIRED"},{status:401});
 if(storageMode()==="supabase"){try{const ids=new Set(await tenantMissionIds(tenantId));const [allMissions,allEvents]=await Promise.all([listPersistedMissions(100),listPersistedEvents(500)]);const ms=allMissions.filter(m=>ids.has(m.id));const es=allEvents.filter(e=>ids.has(e.missionId));return NextResponse.json({ok:true,metrics:calculateCommercialMetrics(ms,es),tenantId,persistence:"supabase",durable:true})}catch{return NextResponse.json({ok:false,error:"COMMERCIAL_METRICS_FAILED"},{status:503})}}
 const ids=new Set(await tenantMissionIds(tenantId));const ms=[...missions.values()].filter(m=>ids.has(m.id));const es=events.filter(e=>ids.has(e.missionId));return NextResponse.json({ok:true,metrics:calculateCommercialMetrics(ms,es),tenantId,persistence:"in-memory-runtime",durable:false});
}