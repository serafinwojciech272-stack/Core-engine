import test from "node:test";
import assert from "node:assert/strict";
import { compareCounterfactual, counterfactualGate } from "../lib/counterfactual-reasoning";

test("M12.4 compares an alternative against observed reality",()=>{
  const x=compareCounterfactual({baselineOutcome:100,observedOutcome:105,alternativeOutcome:115,confidence:.8,assumptions:["same demand"]});
  assert.equal(x.difference,10);
  assert.equal(x.sensitivity,"MATERIAL_EFFECT");
});

test("M12.4 requires assumptions and confidence",()=>{
  assert.equal(counterfactualGate({confidence:.8,materialEffect:true,assumptionCount:0}).status,"HOLD");
  assert.equal(counterfactualGate({confidence:.5,materialEffect:true,assumptionCount:1}).status,"HOLD");
  assert.equal(counterfactualGate({confidence:.8,materialEffect:true,assumptionCount:1}).status,"RELEVANT");
});
