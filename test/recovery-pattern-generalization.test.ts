import test from "node:test";
import assert from "node:assert/strict";
import { buildRecoveryPattern } from "../lib/recovery-pattern-generalization";
test("M11.3 generalizes the same failure/recovery into a stable signature",()=>{
 const a=buildRecoveryPattern({tenantId:"t",problem:"API timeout in CRM",failureType:"TOOL",failureReason:"timeout",recoveryAction:"retry with backoff"});
 const b=buildRecoveryPattern({tenantId:"t",problem:"CRM http timeout",failureType:"TOOL",failureReason:"timeout",recoveryAction:"retry with backoff"});
 assert.equal(a.patternKey,b.patternKey); assert.equal(a.triggerSignature,b.triggerSignature);
});
test("M11.3 does not activate an unverified recovery",()=>{
 const p=buildRecoveryPattern({tenantId:"t",problem:"provider issue",failureType:"DEPENDENCY",recoveryAction:"switch provider"});
 assert.equal(p.failureType,"DEPENDENCY"); assert.deepEqual(p.preconditions,[]);
});
