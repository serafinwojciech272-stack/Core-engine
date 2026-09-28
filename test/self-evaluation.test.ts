import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTrajectory, improvementSignals } from "../lib/self-evaluation";

test("M13.1 detects missing verification and learning",()=>{
  const e=evaluateTrajectory({goalAchieved:true,evidenceVerified:true,decisionCalibrated:true,executionVerified:false,learningExtracted:false,failureRecovered:true});
  assert.equal(e.status,"NEEDS_REVIEW");
  assert.deepEqual(e.gaps,["execution","learning"]);
  assert.equal(improvementSignals(e).length,2);
});

test("M13.1 accepts a fully verified trajectory",()=>{
  const e=evaluateTrajectory({goalAchieved:true,evidenceVerified:true,decisionCalibrated:true,executionVerified:true,learningExtracted:true,failureRecovered:true});
  assert.equal(e.score,1);
  assert.equal(e.status,"HIGH_QUALITY");
});
