import test from "node:test";
import assert from "node:assert/strict";
import {agentFabricReadiness,createExecution,markStep,verifyRun,evaluateRun,policyCheck,remember,recall,consensus,learn,optimize} from "@/lib/m14-m25-agent-fabric";

test("M14 memory persists and recalls runtime context",()=>{remember("test-key",{value:1},.9);assert.deepEqual(recall("test-key")?.value,{value:1});});
test("M17 execution and M18 verification are deterministic",()=>{const run=createExecution("goal",["plan","execute"]);markStep(run,0,"SUCCEEDED");markStep(run,1,"SUCCEEDED");assert.equal(run.status,"COMPLETED");assert.equal(verifyRun(run).passed,true);assert.equal(evaluateRun(run).score,1);});
test("M21 policy blocks unapproved side effects",()=>{const r=policyCheck({toolId:"document.create"});assert.equal(r.allowed,false);assert.equal(r.requiresApproval,true);});
test("M23-M25 consensus learning and optimization return governed decisions",()=>{assert.equal(consensus(["a"],["x","y"]).answerCount,2);assert.equal(learn({score:.9}).accepted,true);assert.ok(["KEEP","REVIEW"].includes(optimize({latencyMs:100,cost:.1,quality:.9}).decision));});
test("M14-M25 fabric is complete at foundation level",()=>{const r=agentFabricReadiness();assert.equal(r.status,"READY");assert.equal(Object.keys(r.stages).length,12);});
