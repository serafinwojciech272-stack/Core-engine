import {NextResponse} from "next/server";
import {getPersistedMissionSnapshot,getPersistedTenderCase} from "@/lib/storage";

const CASE_ID="Z154/68879";
const FALLBACK_MISSION_ID="b7b3c4d1-7f7e-4b1d-9b7d-2c2f7b6a1e55";

export async function GET(){
 try{
  const tender=await getPersistedTenderCase(CASE_ID);
  const missionId=String(tender?.mission_id||FALLBACK_MISSION_ID);
  const snapshot=await getPersistedMissionSnapshot(missionId);
  if(!snapshot.mission) return NextResponse.json({ok:false,error:"MISSION_NOT_FOUND"},{status:404});
  const events=Array.isArray(snapshot.events)?snapshot.events:[];
  const measurement=events.find((e:Record<string,unknown>)=>e.event_type==="MEASUREMENT_RECORDED") as Record<string,unknown>|undefined;
  const learning=Array.isArray(snapshot.learning)?snapshot.learning[0] as Record<string,unknown>|undefined:undefined;
  const before=Number(measurement?.metadata&&typeof measurement.metadata==="object"?(measurement.metadata as Record<string,unknown>).bid_readiness_score_before:NaN);
  const after=Number(measurement?.metadata&&typeof measurement.metadata==="object"?(measurement.metadata as Record<string,unknown>).bid_readiness_score_after:NaN);
  return NextResponse.json({
   ok:true,
   caseId:CASE_ID,
   missionId,
   source:"supabase",
   durable:true,
   mission:snapshot.mission,
   events,
   learning,
   outcome:Number.isFinite(before)&&Number.isFinite(after)?{before,after,delta:after-before,deltaPct:before?((after-before)/before)*100:null}:null,
   executionClassification:events.some((e:Record<string,unknown>)=>e.event_type==="EXECUTION_RECORDED"&&typeof e.metadata==="object"&&(e.metadata as Record<string,unknown>)?.e2e===true)
    ?"E2E_ORCHESTRATED"
    :"LIVE_EXTERNAL_ACTION"
  },{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("[core-engine] tender runtime snapshot failed",error);
  return NextResponse.json({ok:false,error:"TENDER_RUNTIME_SNAPSHOT_FAILED"},{status:503});
 }
}
