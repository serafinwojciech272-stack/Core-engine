import test from "node:test";
import assert from "node:assert/strict";
import { getSecurityControls } from "@/lib/security";

test("M10.10 production security controls remain enabled",()=>{
  const controls=getSecurityControls();
  for(const key of ["requestSizeLimit","signalCountLimit","idempotency","serverOnlySupabaseKey","failClosedRiskGate","noBrokerExecution","auditChain"] as const){
    assert.equal(controls[key],true,key);
  }
});
