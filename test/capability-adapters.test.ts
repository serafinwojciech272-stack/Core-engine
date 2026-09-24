import test from "node:test";
import assert from "node:assert/strict";
import {listCapabilityAdapters,resolveCapabilityAdapter} from "../lib/capability-adapters.ts";
import {getCapabilityAction} from "../lib/capability-action-registry.ts";

test("capability adapter registry exposes a deterministic fallback adapter",()=>{
  const ids=listCapabilityAdapters();
  assert.ok(ids.includes("core.simulation.v1"));
  const action=getCapabilityAction("wordpress.seo.audit");
  if(action) assert.equal(resolveCapabilityAdapter(action)?.id,"core.simulation.v1");
});
