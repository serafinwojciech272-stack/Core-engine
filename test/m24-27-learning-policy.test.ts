import { describe, expect, it } from "vitest";
import { aggregateRecoveryLearningPolicy } from "@/lib/m24-27-learning-policy-engine";

const p=(action:"RESUME"|"REPLAY"|"RECONCILE",outcome:"SUCCESS"|"PARTIAL"|"FAILED"|"UNVERIFIED",weightDelta:-1|0|1,confidenceBps:number)=>({
 tenantId:"t",recoveryKey:"r",executionId:crypto.randomUUID(),action,outcome,
 learningSignal:outcome==="SUCCESS"?"POSITIVE":outcome==="UNVERIFIED"?"NEUTRAL":"NEGATIVE",
 status:outcome==="UNVERIFIED"?"NO_PROMOTION":"PROMOTED",
 policyUpdate:{action,weightDelta,confidenceBps,basis:outcome},
 learningVersion:1,promotionHash:crypto.randomUUID().replaceAll("-",""),promotedAt:new Date().toISOString()
});
describe("M24.27 Learning Policy Aggregation",()=>{
 it("aggregates repeated promoted outcomes per action",()=>{
  const result=aggregateRecoveryLearningPolicy("t","r",[p("RESUME","SUCCESS",1,10000),p("RESUME","SUCCESS",1,10000),p("RESUME","FAILED",-1,10000),p("REPLAY","PARTIAL",-1,5000)]);
  const resume=result.find(x=>x.action==="RESUME")!;
  expect(resume.sampleCount).toBe(3); expect(resume.successCount).toBe(2); expect(resume.failedCount).toBe(1); expect(resume.netWeight).toBe(1); expect(resume.confidenceBps).toBe(10000);
 });
 it("isolates tenant and recovery scope",()=>{
  const result=aggregateRecoveryLearningPolicy("t","r",[p("RESUME","SUCCESS",1,10000),{...p("RESUME","SUCCESS",1,10000),tenantId:"other"}]);
  expect(result.find(x=>x.action==="RESUME")!.sampleCount).toBe(1);
 });
});