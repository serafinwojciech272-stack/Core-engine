import test from "node:test";
import assert from "node:assert/strict";
import { verifyRecoveryExecution } from "@/lib/m24-25-verification-engine";

const execution={executionId:"e1",tenantId:"t1",recoveryKey:"r1",action:"RESUME" as const,status:"EXECUTED" as const,approvalId:"a1",decisionHash:"d1",executionHash:"x1",executedBy:"human-1",executedAt:"2026-10-03T00:00:00.000Z"};

test("M24.25 success",()=>{const r=verifyRecoveryExecution({tenantId:"t1",recoveryKey:"r1",execution,expectedState:{cursor:"10",status:"ready"},observedState:{cursor:"10",status:"ready"}});assert.equal(r.outcome,"SUCCESS");assert.equal(r.learningSignal,"POSITIVE");});
test("M24.25 partial",()=>{const r=verifyRecoveryExecution({tenantId:"t1",recoveryKey:"r1",execution,expectedState:{cursor:"10",status:"ready"},observedState:{cursor:"10",status:"paused"}});assert.equal(r.outcome,"PARTIAL");assert.equal(r.learningSignal,"NEGATIVE");});
test("M24.25 scope",()=>{assert.throws(()=>verifyRecoveryExecution({tenantId:"t2",recoveryKey:"r1",execution,expectedState:{},observedState:{}}),/RECOVERY_VERIFICATION_SCOPE_MISMATCH/);});
