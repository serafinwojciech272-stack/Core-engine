import test from "node:test";
import assert from "node:assert/strict";
import { promoteRecoveryLearning } from "@/lib/m24-26-learning-promotion-engine";
const base={tenantId:"tenant-a",recoveryKey:"recovery-a",executionId:"execution-a",action:"RESUME" as const,learningSignal:"POSITIVE" as const,matchedKeys:["status"],mismatchedKeys:[],verificationHash:"hash",verifiedAt:"2026-10-03T00:00:00.000Z",reason:"EXPECTED_STATE_MATCHED"};
test("M24.26 promotes successful recovery learning",()=>{const result=promoteRecoveryLearning({...base,outcome:"SUCCESS"});assert.equal(result.status,"PROMOTED");assert.equal(result.policyUpdate.weightDelta,1);assert.equal(result.policyUpdate.confidenceBps,10000);assert.equal(result.promotionHash.length,64);});
test("M24.26 promotes failed learning negatively",()=>{const result=promoteRecoveryLearning({...base,outcome:"FAILED",learningSignal:"NEGATIVE"});assert.equal(result.status,"PROMOTED");assert.equal(result.policyUpdate.weightDelta,-1);});
test("M24.26 does not promote unverified evidence",()=>{const result=promoteRecoveryLearning({...base,outcome:"UNVERIFIED",learningSignal:"NEUTRAL"});assert.equal(result.status,"NO_PROMOTION");assert.equal(result.policyUpdate.weightDelta,0);});
