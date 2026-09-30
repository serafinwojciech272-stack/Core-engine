import test from "node:test";
import assert from "node:assert/strict";
import { buildCalibrationSummary } from "@/lib/prediction-calibration";

const base={id:"1",decisionId:"d",missionId:"m",engineVersion:"M10",p1R:0.8,p2R:0.1,p3R:0.1,expectedR:1,riskGate:"PASS",predictionSource:"DERIVED",calibrationStatus:"UNCALIBRATED",predictionPayload:{},realizedR:1,outcomePayload:{},createdAt:"",resolvedAt:""} as const;

test("M10.10 computes real resolved outcome metrics",()=>{
  const summary=buildCalibrationSummary([
    {...base,id:"1",outcomeStatus:"WON"},
    {...base,id:"2",p1R:0.2,outcomeStatus:"LOST"},
    {...base,id:"3",outcomeStatus:"OPEN",realizedR:null}
  ]);
  assert.equal(summary.total,3);
  assert.equal(summary.resolved,2);
  assert.equal(summary.won,1);
  assert.equal(summary.lost,1);
  assert.equal(summary.open,1);
  assert.equal(summary.hitRate,0.5);
  assert.equal(summary.calibrationStatus,"INSUFFICIENT_DATA");
});

test("M10.10 does not label small samples calibrated",()=>{
  assert.equal(buildCalibrationSummary([]).calibrationStatus,"INSUFFICIENT_DATA");
});
