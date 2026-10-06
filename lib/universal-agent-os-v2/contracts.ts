export type Risk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AgentState = "DRAFT" | "READY" | "WAITING_APPROVAL" | "PERMITTED" | "EXECUTING" | "VERIFYING" | "OUTCOME" | "LEARNING" | "BLOCKED" | "ROLLED_BACK";
export type Decision = "APPROVE" | "REJECT" | "ESCALATE" | "DEFER";

export interface Mission {
  id: string; tenantId: string; goal: string; risk: Risk; state: AgentState;
  policyVersion: string; correlationId: string; requiredCapabilities: string[];
}
export interface PolicyContext {
  tenantId: string; actorId: string; missionId: string; risk: Risk;
  capabilities: string[]; approvals: string[]; environment: "DEV" | "STAGING" | "PRODUCTION";
}
export interface PolicyDecision {
  decision: Decision; reason: string; policyVersion: string; requiresHumanApproval: boolean;
  permitted: boolean;
}
export interface PermissionLease {
  id: string; missionId: string; expiresAt: number; scopes: string[]; approvedBy: string;
}
export interface ExecutionPlan {
  missionId: string; steps: string[]; dependencies: Record<string,string[]>; estimatedCost: number;
}
export interface Evidence {
  id: string; missionId: string; kind: string; hash: string; source: string; timestamp: number;
}
export interface Outcome {
  missionId: string; status: "SUCCESS" | "PARTIAL" | "FAILED" | "UNVERIFIED";
  evidenceIds: string[]; score: number; reason: string;
}
export interface AuditEvent {
  id: string; missionId: string; type: string; actor: string; payloadHash: string; timestamp: number;
}
