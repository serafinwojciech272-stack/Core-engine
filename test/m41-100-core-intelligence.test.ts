import assert from "node:assert/strict";
import test from "node:test";
import { listM41ToM100Stages, runCoreEngineM41ToM100 } from "../lib/m41-100-core-intelligence";

test("M41-M100 exposes exactly 60 stages",()=>{const s=listM41ToM100Stages();assert.equal(s.length,60);assert.equal(s[0].id,"M41");assert.equal(s[59].id,"M100");});
test("M41-M100 routes, fuses evidence and reaches the production control plane",()=>{
 const r=runCoreEngineM41ToM100({tenantId:"t",requestId:"r",request:"Zrób analizę biznesową i prognozę",evidence:[
  {id:"1",source:"primary",claim:"revenue trend",value:100,quality:.9,reliability:.9,independence:.9,observedAt:"2026-01-01"},
  {id:"2",source:"primary",claim:"revenue trend",value:120,quality:.9,reliability:.9,independence:.9,observedAt:"2026-06-01"},
  {id:"3",source:"secondary",claim:"market growth",value:10,quality:.8,reliability:.8,independence:.8,observedAt:"2026-06-01"},
  {id:"4",source:"secondary",claim:"customer demand",value:20,quality:.8,reliability:.8,independence:.8,observedAt:"2026-06-01"},
  {id:"5",source:"independent",claim:"competition",value:3,quality:.8,reliability:.8,independence:.8,observedAt:"2026-06-01"}
 ],options:[{id:"a",label:"A",probability:.7,benefit:100,cost:20,risk:10},{id:"b",label:"B",probability:.5,benefit:80,cost:10,risk:15}],resources:{budget:100}});
 assert.equal(r.version,"M100"); assert.equal(r.stages.length,60); assert.equal(r.stages.at(-1)?.stage,"M100"); assert.notEqual(r.runHash,""); assert.equal(r.executionGate,"READY_FOR_APPROVAL");
});
test("M41 and M42 fail closed for invalid/unknown requests",()=>{const r=runCoreEngineM41ToM100({tenantId:"",requestId:"",request:"",evidence:[]});assert.equal(r.state,"BLOCKED");assert.equal(r.executionGate,"BLOCKED");});
test("M100 never bypasses human approval",()=>{const r=runCoreEngineM41ToM100({tenantId:"t",requestId:"r",request:"business plan strategy",evidence:[{id:"1",source:"s",claim:"market",quality:1}] ,executionRequested:true});assert.equal(r.executionGate,"BLOCKED");});
