import { createHash } from "node:crypto";
import type { RecoveryDecisionResult } from "@/lib/recovery-decision-engine";

export type ApprovalAction = "APPROVE" | "REJECT";
export type ExecutionPermission = "GRANTED" | "DENIED";
export type RecoveryApprovalWeight = { netWeight: number; confidenceBps: number; sampleCount: number; policyVersion: number; };
export type PolicyConfidenceEscalation = "STANDARD_APPROVAL" | "ENHANCED_REVIEW" | "MANUAL_ESCALATION";
export type PolicyConfidenceEscalationResult = { level: PolicyConfidenceEscalation; confidenceBps: number; sampleCount: number; netWeight: number; requiresEnhancedReview: boolean; requiresManualEscalation: boolean; reason: string; };

export type RecoveryApprovalRequest = {
  tenantId: string;
  recoveryKey: string;
  decision: Omit<RecoveryDecisionResult, "source"> & { source: "RECOVERY_STATE" | "RECOVERY_STATE + LEARNING_POLICY" };
  action: ApprovalAction;
  actorId: string;
  actorKind: "human" | "system" | "agent" | "anonymous";
  idempotencyKey: string;
  reason?: string | null;
  policyWeight?: RecoveryApprovalWeight | null;
};

export type RecoveryApprovalResult = {
  status: "APPROVED" | "REJECTED" | "IDEMPOTENT";
  approvalId: string;
  tenantId: string;
  recoveryKey: string;
  decision: RecoveryDecisionResult["decision"];
  decisionHash: string;
  action: ApprovalAction;
  executionPermission: ExecutionPermission;
  approvedBy: string;
  approvedAt: string;
  reason: string | null;
  policyWeight: RecoveryApprovalWeight | null;
  approvalTier: "POLICY_SUPPORTED" | "POLICY_UNSUPPORTED";
  confidenceEscalation: PolicyConfidenceEscalationResult;
};

export type RecoveryApprovalPort = { approve(request: RecoveryApprovalRequest): Promise<RecoveryApprovalResult>; };

export class ApprovalConflictError extends Error {
  constructor() { super("RECOVERY_APPROVAL_IDEMPOTENCY_CONFLICT"); this.name = "ApprovalConflictError"; }
}

export function evaluatePolicyConfidenceEscalation(policy: RecoveryApprovalWeight | null): PolicyConfidenceEscalationResult {
  if (!policy) return { level:"MANUAL_ESCALATION", confidenceBps:0, sampleCount:0, netWeight:0, requiresEnhancedReview:true, requiresManualEscalation:true, reason:"No selected learning policy is available; manual escalation is required before execution approval." };
  const { confidenceBps, sampleCount, netWeight } = policy;
  if (netWeight < 0) return { level:"MANUAL_ESCALATION", confidenceBps, sampleCount, netWeight, requiresEnhancedReview:true, requiresManualEscalation:true, reason:"Policy has negative net weight; confidence cannot reduce the need for manual escalation." };
  if (confidenceBps >= 8000 && sampleCount >= 5) return { level:"STANDARD_APPROVAL", confidenceBps, sampleCount, netWeight, requiresEnhancedReview:false, requiresManualEscalation:false, reason:"Policy has high confidence, sufficient sample size, and non-negative weight; standard human approval applies." };
  if (confidenceBps >= 5000 && sampleCount >= 2) return { level:"ENHANCED_REVIEW", confidenceBps, sampleCount, netWeight, requiresEnhancedReview:true, requiresManualEscalation:false, reason:"Policy confidence is usable but below the standard threshold; enhanced human review is required." };
  return { level:"MANUAL_ESCALATION", confidenceBps, sampleCount, netWeight, requiresEnhancedReview:true, requiresManualEscalation:true, reason:"Policy confidence or sample size is too low for standard approval; manual escalation is required." };
}

export function hashRecoveryDecision(decision: RecoveryApprovalRequest["decision"]): string { return createHash("sha256").update(JSON.stringify(decision)).digest("hex"); }

export function evaluateApprovalRequest(request: RecoveryApprovalRequest): RecoveryApprovalResult {
  if (!request.tenantId || !request.recoveryKey || !request.idempotencyKey || !request.actorId) throw new Error("RECOVERY_APPROVAL_INPUT_INVALID");
  if (request.decision.tenantId !== request.tenantId || request.decision.recoveryKey !== request.recoveryKey) throw new Error("RECOVERY_APPROVAL_DECISION_SCOPE_MISMATCH");
  if (request.policyWeight && (request.policyWeight.sampleCount < 1 || request.policyWeight.confidenceBps < 0 || request.policyWeight.confidenceBps > 10000)) throw new Error("RECOVERY_APPROVAL_POLICY_INVALID");
  const decisionHash = hashRecoveryDecision(request.decision);
  const approved = request.action === "APPROVE";
  const executableDecision = request.decision.decision !== "NO_ACTION" && request.decision.requiresApproval;
  const confidenceEscalation = evaluatePolicyConfidenceEscalation(request.policyWeight);
  return {
    status: approved ? "APPROVED" : "REJECTED", approvalId:"pending", tenantId:request.tenantId, recoveryKey:request.recoveryKey,
    decision:request.decision.decision, decisionHash, action:request.action,
    executionPermission: approved && executableDecision ? "GRANTED" : "DENIED",
    approvedBy:request.actorId, approvedAt:new Date().toISOString(), reason:request.reason ?? null,
    policyWeight:request.policyWeight ?? null,
    approvalTier:request.policyWeight && request.policyWeight.netWeight >= 0 && request.policyWeight.confidenceBps >= 5000 ? "POLICY_SUPPORTED" : "POLICY_UNSUPPORTED",
    confidenceEscalation,
  };
}

export class InMemoryRecoveryApprovalGate implements RecoveryApprovalPort {
  private readonly approvals = new Map<string, { hash: string; result: RecoveryApprovalResult }>();
  async approve(request: RecoveryApprovalRequest): Promise<RecoveryApprovalResult> {
    const result = evaluateApprovalRequest(request); const existing = this.approvals.get(request.idempotencyKey);
    if (existing) { if (existing.hash !== result.decisionHash || existing.result.action !== result.action) throw new ApprovalConflictError(); return { ...existing.result, status:"IDEMPOTENT" }; }
    result.approvalId = crypto.randomUUID(); this.approvals.set(request.idempotencyKey,{hash:result.decisionHash,result}); return result;
  }
}

export async function submitRecoveryApproval(request: RecoveryApprovalRequest, gate: RecoveryApprovalPort): Promise<RecoveryApprovalResult> { return gate.approve(request); }
