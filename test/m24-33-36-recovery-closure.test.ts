import test from "node:test";
import assert from "node:assert/strict";
import { verifyPersistedEscalationEvidence } from "@/lib/m24-33-escalation-evidence-integrity";
import { reconcileEscalationControl } from "@/lib/m24-34-escalation-reconciliation";
import { evaluateRecoveryClosure } from "@/lib/m24-35-recovery-closure";

const evidence = {
  evidenceId:"e1", tenantId:"t1", recoveryKey:"r1", idempotencyKey:"i1", decisionHash:"d1",
  level:"STANDARD_APPROVAL" as const, verified:true, approvalAllowed:true,
  evidence:{evidenceHash:"e1-hash",verifiedAt:"2026-10-04T00:00:00.000Z",checks:["POLICY"],failures:[]},
  createdAt:"2026-10-04T00:00:00.000Z"
};

test("M24.33 accepts matching verified evidence",()=>{
 const result=verifyPersistedEscalationEvidence(evidence,"d1");
 assert.equal(result.valid,true); assert.equal(result.approvalAllowed,true);
});

test("M24.33 blocks mismatched evidence",()=>{
 const result=verifyPersistedEscalationEvidence(evidence,"wrong");
 assert.equal(result.valid,false); assert.equal(result.approvalAllowed,false);
 assert.deepEqual(result.failures,["DECISION_HASH_MISMATCH"]);
});

test("M24.34 reconciles approval permission with evidence",()=>{
 const integrity=verifyPersistedEscalationEvidence(evidence,"d1");
 const result=reconcileEscalationControl(evidence,integrity,"GRANTED");
 assert.equal(result.reconciled,true); assert.equal(result.executionPermission,"GRANTED");
});

test("M24.34 blocks denied approval",()=>{
 const integrity=verifyPersistedEscalationEvidence(evidence,"d1");
 const result=reconcileEscalationControl(evidence,integrity,"DENIED");
 assert.equal(result.reconciled,false); assert.equal(result.executionPermission,"DENIED");
 assert.deepEqual(result.failures,["APPROVAL_PERMISSION_DENIED"]);
});

test("M24.35 closes only after execution verification and learning promotion",()=>{
 const result=evaluateRecoveryClosure({approvalPermission:"GRANTED",executionPermission:"GRANTED",verificationPassed:true,learningPromoted:true});
 assert.equal(result.closable,true); assert.equal(result.state,"CLOSE_READY");
});

test("M24.35 keeps recovery open when learning is not promoted",()=>{
 const result=evaluateRecoveryClosure({approvalPermission:"GRANTED",executionPermission:"GRANTED",verificationPassed:true,learningPromoted:false});
 assert.equal(result.closable,false); assert.deepEqual(result.failures,["LEARNING_NOT_PROMOTED"]);
});

test("M24.36 terminal control-plane contract blocks any unsafe transition",()=>{
 const integrity=verifyPersistedEscalationEvidence(evidence,"d1");
 const reconciliation=reconcileEscalationControl(evidence,integrity,"GRANTED");
 const closure=evaluateRecoveryClosure({
   approvalPermission:"GRANTED",
   executionPermission:reconciliation.executionPermission,
   verificationPassed:true,
   learningPromoted:true
 });
 assert.equal(reconciliation.reconciled,true);
 assert.equal(closure.closable,true);
});

test("M24.36 fails closed when any terminal control condition is missing",()=>{
 const result=evaluateRecoveryClosure({approvalPermission:"GRANTED",executionPermission:"GRANTED",verificationPassed:false,learningPromoted:true});
 assert.equal(result.closable,false); assert.equal(result.state,"CLOSE_BLOCKED"); assert.deepEqual(result.failures,["POST_EXECUTION_VERIFICATION_FAILED"]);
});
