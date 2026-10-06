import test from "node:test";
import assert from "node:assert/strict";
import {toSkillManifestV2,buildSkillDependencyGraph,evaluatePreconditions,verifySkillOutcome,generateSkillEvidence} from "../lib/skill-intelligence";

const manifest=(id:string,deps:string[]=[])=>toSkillManifestV2({
 id,version:"1",name:id,description:id,domains:["agent"],capabilities:["OBSERVE"],risk:"LOW",
 inputSchema:{required:[],properties:{}},outputSchema:{required:["result"],properties:{result:"string"}},
 preconditions:["world-ready"],postconditions:["result-recorded"],dependencies:deps,tags:["agent"]
},{publisher:"core-engine",trust:"VERIFIED",evidence:[],cost:{latencyMs:1,credits:1},reliability:1});

test("M181 builds dependency graph and detects unresolved dependencies",()=>{
 const a=manifest("a"),b=manifest("b",["a"]),c=manifest("c",["missing"]);
 const graph=buildSkillDependencyGraph([a,b,c]);
 assert.deepEqual(graph.edges,[{from:"a",to:"b"}]);
 assert.deepEqual(graph.unresolved,["c->missing"]);
 assert.equal(graph.cycles.length,0);
});

test("M182 evaluates declared preconditions fail-closed",()=>{
 const skill=manifest("a");
 assert.equal(evaluatePreconditions(skill,new Set()).satisfied,false);
 assert.equal(evaluatePreconditions(skill,new Set(["world-ready"])).satisfied,true);
});

test("M183+M184 verifies output and postconditions",()=>{
 const skill=manifest("a");
 const result=verifySkillOutcome(skill,{result:"ok"},new Set(["result-recorded"]));
 assert.equal(result.verified,true);
 assert.equal(verifySkillOutcome(skill,{},new Set()).verified,false);
});

test("M185 generates deterministic evidence fingerprint",()=>{
 const a=generateSkillEvidence({skillId:"a",claim:"ok",provenance:{source:"test"},createdAt:"2026-10-06T00:00:00.000Z"});
 const b=generateSkillEvidence({skillId:"a",claim:"ok",provenance:{source:"test"},createdAt:"2026-10-06T00:00:00.000Z"});
 assert.equal(a.fingerprint,b.fingerprint);
 assert.equal(a.id,a.fingerprint);
});
