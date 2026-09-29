import test from "node:test";
import assert from "node:assert/strict";
import {buildMissionReport} from "../lib/mission-report.ts";
const mission={id:"m1",decisionId:"d1",objective:"Improve conversion",state:"LEARNED",kpi:"conversion",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),executionCount:1};
const events=[
{id:"1",missionId:"m1",eventType:"MISSION_CREATED",actorType:"system",createdAt:new Date(0).toISOString(),metadata:{objective:"Improve conversion",selectionReason:"High expected value"}},
{id:"2",missionId:"m1",eventType:"CAPABILITY_EXECUTED",actorType:"agent",createdAt:new Date(1000).toISOString(),metadata:{actionId:"growth.optimize",predicted:10,actual:12,evidenceId:"ev1"}},
{id:"3",missionId:"m1",eventType:"LEARNING_RECORDED",actorType:"system",createdAt:new Date(2000).toISOString(),metadata:{lesson:"Validated conversion improvement."}}
];
test("mission report proves outcome, provenance and learning",()=>{const r=buildMissionReport({mission,events,tenantId:"t1"});assert.equal(r.outcome.quality,"VERIFIED");assert.equal(r.outcome.predicted,10);assert.equal(r.outcome.actual,12);assert.equal(r.outcome.delta,2);assert.equal(r.evidence.evidenceRefs[0],"ev1");assert.equal(r.commercial.valueEvidenceAvailable,true);assert.equal(r.summary.whatItLearned[0],"Validated conversion improvement.");});
test("mission report never invents outcome",()=>{const r=buildMissionReport({mission:{...mission,state:"EXECUTING"},events:events.slice(0,1),tenantId:"t1"});assert.equal(r.outcome.quality,"UNVERIFIED");assert.equal(r.outcome.actual,undefined);assert.equal(r.summary.predictionCorrect,null);});
