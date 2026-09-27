import test from "node:test";
import assert from "node:assert/strict";
import { classifyFailure, deriveRecoveryLearning } from "../lib/failure-recovery-learning";

test("M11.2 classifies tool failures",()=>assert.equal(classifyFailure({failureReason:"API timeout"}),"TOOL"));
test("M11.2 classifies hypothesis failures",()=>assert.equal(classifyFailure({failureReason:"wrong assumption about demand"}),"HYPOTHESIS"));
test("M11.2 only treats successful recovery as verified",()=>{
 assert.equal(deriveRecoveryLearning({failureType:"EXECUTION",failureReason:"step failed",recoverySuccess:true}).recoveryQuality,"VERIFIED");
 assert.equal(deriveRecoveryLearning({failureType:"EXECUTION",failureReason:"step failed",recoverySuccess:null}).recoveryQuality,"UNVERIFIED");
});
