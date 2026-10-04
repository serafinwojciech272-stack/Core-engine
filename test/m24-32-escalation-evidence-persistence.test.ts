import test from "node:test";
import assert from "node:assert/strict";
import { verifyPolicyEscalation } from "@/lib/recovery-approval-gate";
import { SupabaseRecoveryEscalationEvidencePersistence } from "@/lib/m24-32-escalation-evidence-persistence";

test("M24.32 persists verified escalation evidence through the RPC contract", async () => {
  const calls: Array<{name:string;body:Record<string,unknown>}> = [];
  const persistence = new SupabaseRecoveryEscalationEvidencePersistence(async (name, body) => {
    calls.push({name,body});
    return {
      evidenceId:"evidence-1",tenantId:"tenant-1",recoveryKey:"recovery-1",idempotencyKey:"idem-1",
      decisionHash:"decision-hash",level:"STANDARD_APPROVAL",verified:true,approvalAllowed:true,
      evidence:{evidenceHash:"evidence-hash",verifiedAt:"2026-10-04T00:00:00.000Z",checks:["POLICY_AWARE_DECISION"],failures:[]},
      createdAt:"2026-10-04T00:00:00.000Z"
    };
  });
  const decision = {
    tenantId:"tenant-1",recoveryKey:"recovery-1",decision:"RESUME",requiresApproval:true,
    source:"RECOVERY_STATE + LEARNING_POLICY" as const,commitId:"commit-1",payloadHash:"payload-1",checkpoint:1,
    checks:["POLICY"],reasons:["policy"],selectedPolicy:undefined
  } as any;
  const verification = verifyPolicyEscalation({netWeight:1,confidenceBps:9000,sampleCount:6,policyVersion:1},decision);
  const result = await persistence.commit({tenantId:"tenant-1",recoveryKey:"recovery-1",idempotencyKey:"idem-1",decisionHash:"decision-hash",verification});
  assert.equal(result.evidenceId,"evidence-1");
  assert.equal(calls[0].name,"ce_recovery_escalation_evidence_commit");
  assert.equal(calls[0].body.p_approval_allowed,true);
});

test("M24.32 preserves a failed/manual escalation as durable evidence", async () => {
  const calls: Array<{name:string;body:Record<string,unknown>}> = [];
  const persistence = new SupabaseRecoveryEscalationEvidencePersistence(async (name, body) => {
    calls.push({name,body});
    return {ok:true};
  });
  const decision = {
    tenantId:"tenant-1",recoveryKey:"recovery-1",decision:"RESUME",requiresApproval:true,
    source:"RECOVERY_STATE + LEARNING_POLICY" as const
  } as any;
  const verification = verifyPolicyEscalation(null,decision);
  await persistence.commit({tenantId:"tenant-1",recoveryKey:"recovery-1",idempotencyKey:"idem-2",decisionHash:"hash",verification});
  assert.equal(calls[0].body.p_verified,true);
  assert.equal(calls[0].body.p_approval_allowed,false);
  assert.deepEqual(calls[0].body.p_failures,["POLICY_MISSING"]);
});
