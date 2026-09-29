import test from "node:test";
import assert from "node:assert/strict";
import { buildCommercialProofMetrics } from "@/lib/commercial-proof";
import type { Mission } from "@/lib/engine";
import type { EngineEvent } from "@/lib/engine";
import type { MissionReport } from "@/lib/mission-report";
import type { CommercialValueCase } from "@/lib/commercial-value";

const mission=(id:string,state:Mission["state"]):Mission=>({id,decisionId:"d-"+id,objective:"Increase qualified leads",state,kpi:"qualified_leads",createdAt:"2026-09-29T10:00:00.000Z",updatedAt:"2026-09-29T10:05:00.000Z",executionCount:1});
const event=(missionId:string,eventType:EngineEvent["eventType"]):EngineEvent=>({id:"e-"+missionId+eventType,missionId,eventType,actorType:"system",createdAt:"2026-09-29T10:02:00.000Z"});
const report=(id:string,quality:MissionReport["outcome"]["quality"],actual?:number):MissionReport=>({missionId:id,objective:"Increase qualified leads",state:"LEARNED",summary:{whatSystemSaw:["signal"],whatItBelieved:["diagnosis"],whatItDidNotKnow:["baseline"],whyMissionSelected:"priority",whatActionItTook:["action"],whatHappened:["result"],predictionCorrect:actual===undefined?null:quality==="VERIFIED",whatItLearned:[],nextAction:"next"},evidence:{eventCount:2,evidenceRefs:["ev-1"],provenanceCoverage:.5},outcome:{predicted:100,actual,delta:actual===undefined?undefined:actual-100,quality},commercial:{timeToValueMs:300000,valueEvidenceAvailable:actual!==undefined},trace:[]});

test("commercial proof never invents ROI or time-to-first-mission",()=>{
 const m=[mission("m1","LEARNED"),mission("m2","COMPLETED")];
 const rs=[report("m1","VERIFIED",120),report("m2","UNVERIFIED")];
 const es=[{...event("m1","STATE_CHANGED"),fromState:"AWAITING_APPROVAL",toState:"APPROVED"},event("m1","CAPABILITY_EXECUTED"),{...event("m2","STATE_CHANGED"),fromState:"AWAITING_APPROVAL",toState:"APPROVED"}];
 const valueCase:CommercialValueCase={id:"v1",tenantId:"t1",missionId:"m1",name:"Revenue pilot",currency:"EUR",baselineValue:10000,targetValue:12000,actualValue:13000,investmentValue:1000,valueDelta:3000,roiPct:200,quality:"VERIFIED",createdAt:"2026-09-29T10:00:00.000Z",updatedAt:"2026-09-29T10:05:00.000Z"};
 const x=buildCommercialProofMetrics({missions:m,events:es,reports:rs,valueCases:[valueCase]});
 assert.equal(x.missionCount,2);
 assert.equal(x.approvalRate,1);
 assert.equal(x.executionRate,.5);
 assert.equal(x.verifiedOutcomeRate,1);
 assert.equal(x.roiAvailable,false);
 assert.equal(x.financialBaselineAvailable,true);
 assert.equal(x.aggregateValueDelta,3000);
 assert.equal(x.aggregateInvestment,1000);
 assert.equal(x.aggregateRoiPct,200);
 assert.equal(x.timeToFirstMissionMs,null);
 assert.equal(x.timeToValueMs,300000);
 assert.ok(x.missingEvidence.includes("BILLING_SUBSCRIPTION_EVIDENCE"));
});
