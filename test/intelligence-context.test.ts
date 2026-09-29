import test from "node:test";
import assert from "node:assert/strict";
import { buildIntelligenceContext } from "@/lib/intelligence-context";
test("M10.5 bounds and ranks intelligence context",()=>{
  const result=buildIntelligenceContext({claims:[{id:"low",confidence:.2},{id:"high",confidence:.9}],memories:[{id:"m1",title:"Relevant",content:"x",confidence:.8,relevance:.9}],unknowns:[{key:"u",importance:"CRITICAL",status:"OPEN"}],contradictions:[{id:"c",status:"OPEN"}],learning:[{lesson:"verified"}]});
  assert.equal(result.version,"M10.5"); assert.equal(result.advisoryOnly,true); assert.equal(result.claims[0].id,"high"); assert.equal(result.decisionConstraints.criticalUnknowns,1); assert.equal(result.decisionConstraints.openContradictions,1);
});
test("M10.5 empty context stays safe",()=>{
  const result=buildIntelligenceContext({claims:[],memories:[],unknowns:[],contradictions:[],learning:[]});
  assert.equal(result.completeness,0); assert.equal(result.confidence,0); assert.deepEqual(result.claims,[]);
});