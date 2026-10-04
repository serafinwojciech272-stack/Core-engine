import test from "node:test";
import assert from "node:assert/strict";
import { decideRecoveryClosure } from "@/lib/m24-38-closure-decision-engine";
import { transitionRecoveryTerminalState } from "@/lib/m24-39-terminal-state-machine";
import { createRecoveryControlAudit } from "@/lib/m24-40-recovery-control-audit";

const base={tenantId:"t1",recoveryKey:"r1",approvalPermission:"GRANTED" as const,executionPermission:"GRANTED" as const,reconciliationPassed:true,verificationPassed:true,learningPromoted:true};
test("M24.38 decides CLOSE only when terminal prerequisites pass",()=>{const r=decideRecoveryClosure(base);assert.equal(r.decision,"CLOSE");assert.equal(r.terminal,true);});
test("M24.38 keeps recovery open when prerequisite fails",()=>{const r=decideRecoveryClosure({...base,learningPromoted:false});assert.equal(r.decision,"KEEP_OPEN");assert.match(r.reason,/LEARNING_NOT_PROMOTED/);});
test("M24.39 makes CLOSED immutable",()=>{const r=transitionRecoveryTerminalState("CLOSED","OPEN");assert.equal(r.allowed,false);assert.equal(r.to,"CLOSED");});
test("M24.39 permits CLOSE_READY before terminal commit",()=>{const r=transitionRecoveryTerminalState("OPEN","CLOSE_READY");assert.equal(r.allowed,true);});
test("M24.40 creates deterministic audit identity",()=>{const input={recoveryKey:"r1",state:"CLOSED" as const,decision:"CLOSE" as const,terminal:true,closureHash:"abc",createdAt:"2026-10-04T10:00:00.000Z"};assert.equal(createRecoveryControlAudit(input).auditId,createRecoveryControlAudit(input).auditId);});
