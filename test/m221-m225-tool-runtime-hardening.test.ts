import test from "node:test";
import assert from "node:assert/strict";
import {clearRuntimeState,withRetry,withTimeout,assertCircuitClosed,recordCircuitFailure,runtimeTransition} from "../lib/tool-runtime/hardening";
import {executeTool} from "../lib/tool-runtime/executor";
import type {ToolContract,ToolInvocation} from "../lib/tool-runtime/contracts";
import type {ExecutionPermission} from "../lib/tool-runtime/permission";

const tool:ToolContract={id:"test.tool",version:"1",name:"test",kind:"API",risk:"LOW",capabilities:["execute"],trusted:true,inputKeys:["value"],outputKeys:["value"]};
const base:ToolInvocation={invocationId:"inv-test",request:{tenantId:"t1",missionId:"m1",toolId:"test.tool",input:{value:"ok"},requestedBy:"test",idempotencyKey:"idem-1",timeoutMs:50,maxAttempts:2},status:"APPROVED"};
const permission:ExecutionPermission={permissionId:"perm-inv-test",invocationId:"inv-test",tenantId:"t1",expiresAt:Date.now()+60_000};

test("M221 lifecycle transitions are bounded",()=>{assert.equal(runtimeTransition("PLANNED","APPROVED"),"APPROVED");assert.throws(()=>runtimeTransition("COMPLETED","EXECUTING"));});
test("M222 idempotency returns the first completed result",async()=>{clearRuntimeState();let calls=0;const adapter=async()=>{calls++;return {value:"ok"}};const a=await executeTool(base,tool,permission,adapter);const b=await executeTool({...base,invocationId:"inv-test-2"},tool,{...permission,invocationId:"inv-test-2"},adapter);assert.equal(calls,1);assert.deepEqual(b.output,a.output);});
test("M223 timeout aborts the tool",async()=>{clearRuntimeState();const i={...base,invocationId:"inv-timeout",request:{...base.request,idempotencyKey:"idem-timeout",timeoutMs:10}} as ToolInvocation;const p={...permission,invocationId:"inv-timeout",permissionId:"perm-inv-timeout"};const result=await executeTool(i,tool,p,async(_input,signal)=>new Promise((_resolve,reject)=>{signal?.addEventListener("abort",()=>reject(new Error("aborted")));}));assert.equal(result.invocation.status,"TIMED_OUT");});
test("M224 retries transient failures",async()=>{let calls=0;const result=await withRetry(async()=>{calls++;if(calls<2)throw new Error("503");return "ok"},{maxAttempts:2,backoffMs:0});assert.equal(result,"ok");assert.equal(calls,2);});
test("M225 opens the circuit after threshold",()=>{clearRuntimeState();recordCircuitFailure("breaker",{failureThreshold:2});assert.doesNotThrow(()=>assertCircuitClosed("breaker",{failureThreshold:2}));recordCircuitFailure("breaker",{failureThreshold:2});assert.throws(()=>assertCircuitClosed("breaker",{failureThreshold:2}),/CIRCUIT_OPEN/);});
test("timeout primitive rejects",async()=>{await assert.rejects(withTimeout(async()=>new Promise(resolve=>setTimeout(()=>resolve("late"),30)),5),/TOOL_TIMEOUT/);});
