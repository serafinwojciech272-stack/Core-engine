import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { certifyMissionUAOSGate } from "@/lib/mission-uaos-gate";

export async function POST(request:Request){
  const g=guardMutation(request,"mission-uaos-gate"); if(g) return g;
  try{
    const b=await request.json();
    const result=certifyMissionUAOSGate({
      qualityCertified:Boolean(b.qualityCertified),
      qualityScore:Number(b.qualityScore),
      missionState:String(b.missionState||""),
      osState:String(b.osState||""),
      approvalId:b.approvalId?String(b.approvalId):null,
      missionId:b.missionId?String(b.missionId):undefined,
      osRunId:b.osRunId?String(b.osRunId):undefined
    });
    return NextResponse.json({ok:result.certified,...result},{status:result.certified?200:422});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"GATE_CERTIFICATION_FAILED"},{status:400});}
}
