import test from "node:test";
import assert from "node:assert/strict";
import {executeCapabilityAction,getCapabilityAction} from "../lib/capability-action-registry.ts";

test("capability action registry resolves registered actions",()=>{
  assert.equal(getCapabilityAction("seo.audit")?.packId,"seo-suite");
});

test("capability action registry requires explicit approval for critical actions",async()=>{
  const blocked=await executeCapabilityAction({actionId:"security.harden",approved:false});
  assert.equal(blocked.status,"APPROVAL_REQUIRED");

  const approved=await executeCapabilityAction({actionId:"security.harden",approved:true});
  assert.equal(approved.status,"EXECUTED");
  assert.equal(approved.sideEffect,false);
  assert.equal(approved.adapterId,"core.simulation.v1");
});

test("capability action registry rejects unknown actions",async()=>{
  const result=await executeCapabilityAction({actionId:"does.not.exist",approved:true});
  assert.equal(result.status,"NOT_FOUND");
});
