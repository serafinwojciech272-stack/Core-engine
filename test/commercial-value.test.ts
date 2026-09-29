import test from "node:test";
import assert from "node:assert/strict";
import {calculateCommercialValue} from "../lib/commercial-value.ts";

test("commercial value ledger calculates verified value and ROI",()=>{
  const result=calculateCommercialValue({baselineValue:10000,targetValue:12000,actualValue:13000,investmentValue:1000});
  assert.equal(result.valueDelta,3000);
  assert.equal(result.roiPct,200);
  assert.equal(result.quality,"VERIFIED");
});

test("commercial value ledger does not invent ROI before actual outcome",()=>{
  const result=calculateCommercialValue({baselineValue:10000,targetValue:12000,investmentValue:1000});
  assert.equal(result.valueDelta,null);
  assert.equal(result.roiPct,null);
  assert.equal(result.quality,"UNVERIFIED");
});

test("commercial value ledger does not fabricate ROI for zero investment",()=>{
  const result=calculateCommercialValue({baselineValue:10000,actualValue:11000,investmentValue:0});
  assert.equal(result.valueDelta,1000);
  assert.equal(result.roiPct,null);
});
