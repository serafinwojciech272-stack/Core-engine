import { createHash } from "node:crypto";

export type GateCertificationInput={qualityCertified:boolean;qualityScore:number;missionState:string;osState:string;approvalId:string|null;missionId?:string;osRunId?:string};
export type GateCertification={certified:boolean;certificateId:string|null;reasons:string[];issuedAt:string;qualityScore:number;approvalId:string|null;missionId?:string;osRunId?:string};
const issued=new Map<string,GateCertification>();
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");

export function certifyMissionUAOSGate(input:GateCertificationInput):GateCertification{
  const reasons:string[]=[];
  if(!input.qualityCertified) reasons.push("QUALITY_NOT_CERTIFIED");
  if(!Number.isFinite(input.qualityScore)||input.qualityScore<90) reasons.push("QUALITY_SCORE_BELOW_90");
  if(input.missionState!=="APPROVED") reasons.push("MISSION_NOT_APPROVED");
  if(input.osState!=="AWAITING_APPROVAL") reasons.push("UAOS_NOT_AWAITING_APPROVAL");
  if(!input.approvalId) reasons.push("UAOS_APPROVAL_MISSING");
  const certified=reasons.length===0,issuedAt=new Date().toISOString();
  const certificateId=certified?"gate_"+digest({input,issuedAt}).slice(0,24):null;
  const result={certified,certificateId,reasons,issuedAt,qualityScore:input.qualityScore,approvalId:input.approvalId,missionId:input.missionId,osRunId:input.osRunId};
  if(certificateId) issued.set(certificateId,result);
  return result;
}
export function isMissionUAOSGateCertified(certificateId:string,input:{missionId?:string;osRunId?:string}){
  const c=issued.get(certificateId); if(!c||!c.certified) return false;
  return (!input.missionId||c.missionId===input.missionId)&&(!input.osRunId||c.osRunId===input.osRunId);
}
