import type { AuditEvent, Decision, Evidence, ExecutionPlan, Mission, Outcome, PermissionLease, PolicyContext, PolicyDecision, Risk } from "./contracts";

const HIGH: Risk[] = ["HIGH", "CRITICAL"];
const now = () => Date.now();
const stableHash = (value: unknown) => {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8,"0");
};

export const STAGES = [
  "M301 ORCHESTRATION_KERNEL","M302 MISSION_COMPILER","M303 STATE_MACHINE","M304 EVENT_LOG","M305 CHECKPOINTS",
  "M306 DETERMINISTIC_REPLAY","M307 POLICY_COMPILER","M308 APPROVAL_BROKER","M309 PERMISSION_LEASE","M310 EXECUTION_SCHEDULER",
  "M311 SANDBOX_BOUNDARY","M312 SECRETS_BOUNDARY","M313 DATA_GOVERNANCE","M314 PRIVACY_CONTROL","M315 TENANT_POLICY",
  "M316 ORG_HIERARCHY","M317 ROLE_DELEGATION","M318 IDENTITY_TRUST","M319 CAPABILITY_SECURITY","M320 THREAT_DETECTION",
  "M321 ANOMALY_DETECTION","M322 RATE_COST_GUARD","M323 RESOURCE_ALLOCATOR","M324 DURABLE_QUEUE","M325 CONCURRENCY_CONTROL",
  "M326 DEPENDENCY_RESOLVER","M327 PLAN_OPTIMIZER","M328 TOOL_ARBITRATION","M329 MODEL_ARBITRATION","M330 SKILL_ARBITRATION",
  "M331 AGENT_ROUTING","M332 MULTI_AGENT_COORDINATION","M333 CONFLICT_RESOLUTION","M334 CONSENSUS","M335 EVIDENCE_GRAPH",
  "M336 PROVENANCE","M337 AUDIT_LEDGER","M338 INCIDENT_RESPONSE","M339 KILL_SWITCH","M340 ROLLBACK",
  "M341 DISASTER_RECOVERY","M342 POLICY_SIMULATION","M343 SHADOW_MODE","M344 CANARY","M345 PRODUCTION_PROMOTION",
  "M346 CERTIFICATION","M347 TENANT_LIFECYCLE","M348 METERING_BILLING_HOOKS","M349 COMMAND_CENTER_TELEMETRY","M350 UNIVERSAL_AGENT_OS_CONTROL_PLANE",
] as const;

export function compileMission(input: Omit<Mission,"state">): Mission {
  if (!input.id || !input.tenantId || !input.goal || !input.correlationId) throw new Error("MISSION_CONTRACT_INVALID");
  return {...input, state:"DRAFT"};
}

export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  const highRisk = HIGH.includes(ctx.risk);
  const privileged = ctx.capabilities.some(c => /write|delete|external|execute/i.test(c));
  const approved = ctx.approvals.includes(ctx.missionId);
  if (ctx.risk === "CRITICAL") return {decision:"REJECT",reason:"CRITICAL_ACTION_BLOCKED_BY_DEFAULT",policyVersion:"v301",requiresHumanApproval:true,permitted:false};
  if (highRisk || privileged) {
    if (!approved) return {decision:"ESCALATE",reason:"HUMAN_APPROVAL_REQUIRED",policyVersion:"v301",requiresHumanApproval:true,permitted:false};
  }
  return {decision:"APPROVE",reason:"POLICY_ALLOWED",policyVersion:"v301",requiresHumanApproval:false,permitted:true};
}

export function issuePermission(mission: Mission, policy: PolicyDecision, approvedBy?: string): PermissionLease {
  if (!policy.permitted) throw new Error("EXECUTION_PERMISSION_DENIED");
  if (policy.requiresHumanApproval && !approvedBy) throw new Error("APPROVAL_REQUIRED");
  return {id:"lease_"+stableHash({mission:mission.id,approvedBy}),missionId:mission.id,expiresAt:now()+60_000,scopes:mission.requiredCapabilities,approvedBy:approvedBy ?? "policy"};
}

export function compilePlan(mission: Mission): ExecutionPlan {
  return {missionId:mission.id,steps:mission.requiredCapabilities.length ? mission.requiredCapabilities : ["verify-only"],dependencies:{},estimatedCost:mission.requiredCapabilities.length};
}

export function verifyOutcome(outcome: Outcome, evidence: Evidence[]): Outcome {
  const valid = outcome.evidenceIds.every(id => evidence.some(e => e.id === id && e.missionId === outcome.missionId));
  if (!valid) return {...outcome,status:"UNVERIFIED",score:0,reason:"EVIDENCE_MISMATCH"};
  return outcome;
}

export function auditEvent(missionId:string,type:string,actor:string,payload:unknown):AuditEvent {
  return {id:"evt_"+stableHash({missionId,type,actor,payload}),missionId,type,actor,payloadHash:stableHash(payload),timestamp:now()};
}

export function rollbackAllowed(risk:Risk, state:Mission["state"]) {
  return state === "EXECUTING" || state === "VERIFYING" || state === "OUTCOME" ? risk !== "CRITICAL" : false;
}

export function stageCount(){ return STAGES.length; }
