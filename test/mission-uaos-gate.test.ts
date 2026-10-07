import test from "node:test";
import assert from "node:assert/strict";
import { certifyMissionUAOSGate,isMissionUAOSGateCertified } from "@/lib/mission-uaos-gate";

test("Mission/UAOS gate certifies only after quality and approval",()=>{
  const r=certifyMissionUAOSGate({qualityCertified:true,qualityScore:100,missionState:"APPROVED",osState:"AWAITING_APPROVAL",approvalId:"m1",missionId:"m1",osRunId:"os1"});
  assert.equal(r.certified,true);
  assert.ok(r.certificateId);
  assert.equal(isMissionUAOSGateCertified(r.certificateId!,{missionId:"m1",osRunId:"os1"}),true);
});
test("Mission/UAOS gate blocks execution certification when quality fails",()=>{
  const r=certifyMissionUAOSGate({qualityCertified:false,qualityScore:80,missionState:"APPROVED",osState:"AWAITING_APPROVAL",approvalId:"m1",missionId:"m1",osRunId:"os1"});
  assert.equal(r.certified,false);
  assert.deepEqual(r.reasons,["QUALITY_NOT_CERTIFIED","QUALITY_SCORE_BELOW_90"]);
});
test("Mission/UAOS gate blocks if OS already executing",()=>{
  const r=certifyMissionUAOSGate({qualityCertified:true,qualityScore:100,missionState:"APPROVED",osState:"EXECUTING",approvalId:"m1",missionId:"m1",osRunId:"os1"});
  assert.equal(r.certified,false);
  assert.ok(r.reasons.includes("UAOS_NOT_AWAITING_APPROVAL"));
});
