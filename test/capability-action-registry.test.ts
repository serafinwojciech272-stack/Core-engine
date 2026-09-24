import test from "node:test";
import assert from "node:assert/strict";
import {executeCapabilityAction,getCapabilityAction} from "../lib/capability-action-registry.ts";

test("capability action registry resolves registered actions",()=>{
  assert.equal(getCapabilityAction("seo.audit")?.packId,"seo-suite");
  assert.equal(getCapabilityAction("external.webhook.dispatch")?.packId,"external-action-fabric");
});

test("capability action registry requires explicit approval for critical actions",async()=>{
  const blocked=await executeCapabilityAction({actionId:"security.harden",approved:false});
  assert.equal(blocked.status,"APPROVAL_REQUIRED");

  const approved=await executeCapabilityAction({actionId:"security.harden",approved:true});
  assert.equal(approved.status,"EXECUTED");
  assert.equal(approved.sideEffect,false);
  assert.equal(approved.adapterId,"core.simulation.v1");
});

test("capability action registry requires approval and routes external action through real adapter",async()=>{
  const blocked=await executeCapabilityAction({actionId:"external.webhook.dispatch",approved:false});
  assert.equal(blocked.status,"APPROVAL_REQUIRED");

  const previous=process.env.CORE_ACTION_WEBHOOK_URL;
  delete process.env.CORE_ACTION_WEBHOOK_URL;
  const result=await executeCapabilityAction({
    actionId:"external.webhook.dispatch",
    approved:true,
    missionId:"m9-test",
    idempotencyKey:"m9-idempotency-1",
    input:{hello:"world"}
  });
  if (previous===undefined) delete process.env.CORE_ACTION_WEBHOOK_URL;
  else process.env.CORE_ACTION_WEBHOOK_URL=previous;
  assert.equal(result.status,"FAILED");
  assert.equal(result.adapterId,"core.external-webhook.v1");
  assert.equal(result.sideEffect,false);
});

test("capability action registry rejects unknown actions",async()=>{
  const result=await executeCapabilityAction({actionId:"does.not.exist",approved:true});
  assert.equal(result.status,"NOT_FOUND");
});
