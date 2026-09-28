import test from "node:test";
import assert from "node:assert/strict";
import { assessDecision, decisionGate } from "../lib/decision-intelligence";

test("M12.3 penalizes downside and rewards evidence",()=>{
  const x=assessDecision([{id:"a",action:"reversible test",expectedBenefit:.8,confidence:.8,downside:.1,reversibility:.9,evidenceStrength:.8,effort:.3}]);
  assert.ok(x[0].utility>.5);
});

test("M12.3 blocks critical risk",()=>{
  const a=assessDecision([{id:"a",action:"action",expectedBenefit:.9,confidence:.9,downside:.2,reversibility:.8,evidenceStrength:.9,effort:.2}])[0];
  assert.equal(decisionGate({assessment:a,approvalRequired:false,criticalRisk:true}).status,"BLOCKED");
});

test("M12.3 routes uncertain decisions back to research",()=>{
  const a={optionId:"a",utility:.4,confidence:.4,reasons:[]};
  assert.equal(decisionGate({assessment:a,approvalRequired:false,criticalRisk:false}).status,"RESEARCH_REQUIRED");
});
