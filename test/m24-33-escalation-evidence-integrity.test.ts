import test from "node:test";
import assert from "node:assert/strict";
import { escalationEvidenceHash, verifyPersistedEscalationEvidence } from "@/lib/m24-33-escalation-evidence-integrity";

const base={evidenceId:"e-1",tenantId:"t-1",recoveryKey:"r-1",idempotencyKey:"i-1",decisionHash:"d-1",level:"STANDARD_APPROVAL" as const,verified:true,approvalAllowed:true,policyWeight:{netWeight:2,confidenceBps:9000,sampleCount:5,policyVersion:3},evidence:{evidenceHash:"",verifiedAt:"2026-10-04T00:00:00.000Z",checks:["POLICY_AWARE_DECISION","HUMAN_APPROVAL_REQUIRED","SAMPLE_PRESENT","CONFIDENCE_RANGE"],failures:[]},createdAt:"2026-10-04T00:00:00.000Z"};
base.evidence.evidenceHash=escalationEvidenceHash({level:base.level,policy:base.policyWeight,decisionHash:base.decisionHash,checks:base.evidence.checks,failures:base.evidence.failures});

test("M24.33 valid persisted evidence replays",()=>{const r=verifyPersistedEscalationEvidence(base,"d-1");assert.equal(r.integrity,"VALID");assert.equal(r.replayable,true);assert.ok(r.checks.includes("EVIDENCE_HASH_REPLAY_MATCH"));});
test("M24.33 detects evidence tampering",()=>{const r=verifyPersistedEscalationEvidence({...base,evidence:{...base.evidence,checks:[...base.evidence.checks,"TAMPERED"]}},"d-1");assert.equal(r.integrity,"TAMPERED");assert.equal(r.replayable,false);assert.ok(r.failures.includes("EVIDENCE_HASH_REPLAY_MISMATCH"));});
test("M24.33 detects decision hash drift",()=>{const r=verifyPersistedEscalationEvidence(base,"different-decision-hash");assert.equal(r.integrity,"TAMPERED");assert.ok(r.failures.includes("DECISION_HASH_MISMATCH"));});
test("M24.33 blocks unverified evidence",()=>{const r=verifyPersistedEscalationEvidence({...base,verified:false},"d-1");assert.equal(r.integrity,"TAMPERED");assert.ok(r.failures.includes("EVIDENCE_NOT_VERIFIED"));});
test("M24.33 missing evidence is invalid",()=>{const r=verifyPersistedEscalationEvidence(null,"d-1");assert.equal(r.integrity,"INVALID");assert.equal(r.replayable,false);});
