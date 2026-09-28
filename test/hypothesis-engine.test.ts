import test from "node:test";
import assert from "node:assert/strict";
import { classifyHypothesisOutcome, generateHypothesis } from "../lib/hypothesis-engine";

test("M12.1 targets the highest-priority unknown",()=>{
  const h=generateHypothesis({tenantId:"t",problem:"sales decline",unknowns:[{id:"1",question:"pricing elasticity",importance:"HIGH"},{id:"2",question:"seasonality",importance:"MEDIUM"}]});
  assert.match(h.hypothesis,/pricing elasticity/);
  assert.equal(h.experimentPlan.length,4);
});

test("M12.1 remains calibrated instead of claiming certainty",()=>{
  const h=generateHypothesis({tenantId:"t",problem:"conversion decline"});
  assert.equal(h.priorProbability,0.5);
  assert.ok(h.confidence<1);
});

test("M12.1 outcome classification",()=>{
  assert.equal(classifyHypothesisOutcome({predicted:true,observed:true,confidence:.8}),"SUPPORTED");
  assert.equal(classifyHypothesisOutcome({predicted:true,observed:false,confidence:.8}),"REFUTED");
  assert.equal(classifyHypothesisOutcome({predicted:true,observed:true,confidence:.5}),"TESTING");
});
