import test from "node:test";
import assert from "node:assert/strict";
import { verifyPersistedEscalationEvidence } from "@/lib/m24-33-escalation-evidence-integrity";
import { reconcileEscalationControl } from "@/lib/m24-34-escalation-reconciliation";
import { evaluateRecoveryClosure } from "@/lib/m24-35-recovery-closure";
import { finalizeRecoveryTerminalControl } from "@/lib/m24-36-terminal-control-plane";
import { certifyRecoveryClosure } from "@/lib/m24-37-recovery-certification";

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
 const terminal=finalizeRecoveryTerminalControl({evidenceVerified:true,reconciliationPassed:true,closure,requestedTransition:"CLOSE"});
 assert.equal(terminal.transitionAllowed,true);
 assert.equal(terminal.terminal,true);
 assert.equal(terminal.state,"CLOSED");
 assert.deepEqual(terminal.failures,[]);
});


test("M24.36 blocks terminal close when evidence is not verified",()=>{
 const closure=evaluateRecoveryClosure({approvalPermission:"GRANTED",executionPermission:"GRANTED",verificationPassed:true,learningPromoted:true});
 const result=finalizeRecoveryTerminalControl({evidenceVerified:false,reconciliationPassed:true,closure,requestedTransition:"CLOSE"});
 assert.equal(result.transitionAllowed,false);
 assert.equal(result.terminal,false);
 assert.equal(result.state,"BLOCKED");
 assert.deepEqual(result.failures,["EVIDENCE_NOT_VERIFIED"]);
});

test("M24.36 blocks terminal close when reconciliation fails",()=>{
 const closure=evaluateRecoveryClosure({approvalPermission:"GRANTED",executionPermission:"GRANTED",verificationPassed:true,learningPromoted:true});
 const result=finalizeRecoveryTerminalControl({evidenceVerified:true,reconciliationPassed:false,closure,requestedTransition:"CLOSE"});
 assert.equal(result.transitionAllowed,false);
 assert.equal(result.state,"BLOCKED");
 assert.deepEqual(result.failures,["RECONCILIATION_FAILED"]);
});


test("M24.37 certifies only a confirmed terminal close",()=>{
 const integrity=verifyPersistedEscalationEvidence(evidence,"d1");
 const reconciliation=reconcileEscalationControl(evidence,integrity,"GRANTED");
 const closure=evaluateRecoveryClosure({approvalPermission:"GRANTED",executionPermission:"GRANTED",verificationPassed:true,learningPromoted:true});
 const terminal=finalizeRecoveryTerminalControl({evidenceVerified:true,reconciliationPassed:true,closure,requestedTransition:"CLOSE"});
 const result=certifyRecoveryClosure({tenantId:"t1",recoveryKey:"r1",idempotencyKey:"i1",terminal,verifiedAt:"2026-10-04T00:00:00.000Z"});
 assert.equal(result.certified,true);
 assert.equal(result.state,"CERTIFIED");
 assert.equal(result.failures.length,0);
 assert.equal(result.certificationHash?.length,64);
});

test("M24.37 blocks certification without terminal close confirmation",()=>{
 const result=certifyRecoveryClosure({tenantId:"t1",recoveryKey:"r1",idempotencyKey:"i1",terminal:{transitionAllowed:false,terminal:false,state:"BLOCKED",failures:[]},verifiedAt:"2026-10-04T00:00:00.000Z"});
 assert.equal(result.certified,false);
 assert.equal(result.state,"BLOCKED");
 assert.equal(result.certificationHash,null);
 assert.deepEqual(result.failures,["TERMINAL_CLOSE_NOT_CONFIRMED"]);
});
