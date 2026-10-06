import test from "node:test";
import assert from "node:assert/strict";
import {toSkillManifestV2,classifySkillFailure,decideRecovery,buildFallbackGraph,estimateSkillCost,assessSkillRisk} from "../lib/skill-intelligence";

const skill=(id:string,risk:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL"="LOW",trust:"UNVERIFIED"|"VERIFIED"|"CERTIFIED"="VERIFIED")=>toSkillManifestV2({
 id,version:"1",name:id,description:id,domains:["research"],capabilities:["OBSERVE"],risk,
 inputSchema:{required:[],properties:{}},outputSchema:{required:[],properties:{}},
 preconditions:[],postconditions:[],dependencies:[],tags:["research"]
},{publisher:"core-engine",trust,evidence:[],cost:{latencyMs:100,credits:2},reliability:.9});

test("M186 classifies transient failures as retryable within budget",()=>{
 assert.equal(classifySkillFailure({code:"TIMEOUT",attempt:1,maxAttempts:3}).retryable,true);
 assert.equal(classifySkillFailure({code:"TIMEOUT",attempt:3,maxAttempts:3}).retryable,false);
});

test("M187 chooses controlled recovery instead of unsafe retry",()=>{
 const decision=decideRecovery(classifySkillFailure({code:"POLICY_DENIED",attempt:1,maxAttempts:3}),true);
 assert.equal(decision.action,"FALLBACK");
 assert.equal(decideRecovery(classifySkillFailure({code:"POLICY_DENIED",attempt:1,maxAttempts:3}),false).action,"ESCALATE");
});

test("M188 builds compatible fallback graph",()=>{
 const primary=skill("primary","MEDIUM");
 const fallback=skill("fallback","LOW");
 const incompatible=toSkillManifestV2({...fallback,id:"other",domains:["finance"]},{publisher:"core-engine",trust:"VERIFIED",evidence:[],cost:{latencyMs:1,credits:1},reliability:1});
 const graph=buildFallbackGraph(primary,[fallback,incompatible]);
 assert.deepEqual(graph.alternatives,["fallback"]);
 assert.deepEqual(graph.blocked,["other"]);
});

test("M189 estimates bounded cost",()=>{
 assert.deepEqual(estimateSkillCost(skill("a"),3),{skillId:"a",expectedCredits:6,expectedLatencyMs:300,confidence:.9});
});

test("M190 requires approval for high risk or unverified trust",()=>{
 assert.equal(assessSkillRisk(skill("a","HIGH")).requiresApproval,true);
 assert.equal(assessSkillRisk(skill("b","LOW","UNVERIFIED")).requiresApproval,true);
});
