import test from "node:test";
import assert from "node:assert/strict";
import { STAGES, compileMission, evaluatePolicy, issuePermission, compilePlan, verifyOutcome, auditEvent, rollbackAllowed, stageCount } from "../lib/universal-agent-os-v2/index.ts";

test("M301-M350 exposes exactly 50 deterministic stages", () => {
  assert.equal(stageCount(),50);
  assert.equal(STAGES[0],"M301 ORCHESTRATION_KERNEL");
  assert.equal(STAGES[49],"M350 UNIVERSAL_AGENT_OS_CONTROL_PLANE");
});

test("mission compiler starts in governed DRAFT state", () => {
  const m=compileMission({id:"m1",tenantId:"t1",goal:"audit",risk:"LOW",policyVersion:"v1",correlationId:"c1",requiredCapabilities:["read"]});
  assert.equal(m.state,"DRAFT");
});

test("high risk and privileged actions fail closed until approval", () => {
  const d=evaluatePolicy({tenantId:"t1",actorId:"a",missionId:"m1",risk:"HIGH",capabilities:["external-write"],approvals:[],environment:"PRODUCTION"});
  assert.equal(d.permitted,false);
  assert.equal(d.requiresHumanApproval,true);
  assert.throws(()=>issuePermission({...compileMission({id:"m1",tenantId:"t1",goal:"x",risk:"HIGH",policyVersion:"v1",correlationId:"c",requiredCapabilities:["external-write"]}),state:"READY"},d),"APPROVAL_REQUIRED");
});

test("critical actions remain blocked", () => {
  const d=evaluatePolicy({tenantId:"t1",actorId:"a",missionId:"m1",risk:"CRITICAL",capabilities:["execute"],approvals:["m1"],environment:"PRODUCTION"});
  assert.equal(d.permitted,false);
});

test("approved policy creates bounded permission and plan", () => {
  const m={...compileMission({id:"m2",tenantId:"t1",goal:"x",risk:"HIGH",policyVersion:"v1",correlationId:"c2",requiredCapabilities:["read","write"]}),state:"READY" as const};
  const d=evaluatePolicy({tenantId:"t1",actorId:"a",missionId:"m2",risk:"HIGH",capabilities:["write"],approvals:["m2"],environment:"PRODUCTION"});
  const lease=issuePermission(m,d,"human");
  assert.equal(lease.missionId,"m2");
  assert.ok(lease.expiresAt>Date.now());
  assert.equal(compilePlan(m).steps.length,2);
});

test("verification rejects foreign evidence", () => {
  const o=verifyOutcome({missionId:"m3",status:"SUCCESS",evidenceIds:["e2"],score:1,reason:"ok"},[{id:"e1",missionId:"m3",kind:"test",hash:"x",source:"test",timestamp:1}]);
  assert.equal(o.status,"UNVERIFIED");
});

test("audit and rollback controls are deterministic and bounded", () => {
  const e=auditEvent("m4","EXECUTION","system",{x:1});
  assert.match(e.id,/^evt_/);
  assert.equal(rollbackAllowed("HIGH","EXECUTING"),true);
  assert.equal(rollbackAllowed("CRITICAL","EXECUTING"),false);
});
