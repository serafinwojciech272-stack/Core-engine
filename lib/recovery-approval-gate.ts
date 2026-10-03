import { createHash } from "node:crypto";
import type { RecoveryDecisionResult } from "@/lib/recovery-decision-engine";

export type ApprovalAction = "APPROVE" | "REJECT";
export type ExecutionPermission = "GRANTED" | "DENIED";

export type RecoveryApprovalRequest = {
  tenantId: string;
  recoveryKey: string;
  decision: RecoveryDecisionResult;
  action: ApprovalAction;
  actorId: string;
  actorKind: "human" | "system" | "agent" | "anonymous";
  idempotencyKey: string;
  reason?: string | null;
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
};

export type RecoveryApprovalPort = {
  approve(request: RecoveryApprovalRequest): Promise<RecoveryApprovalResult>;
};

export class ApprovalConflictError extends Error {
  constructor() {
    super("RECOVERY_APPROVAL_IDEMPOTENCY_CONFLICT");
    this.name = "ApprovalConflictError";
  }
}

export function hashRecoveryDecision(decision: RecoveryDecisionResult): string {
  return createHash("sha256").update(JSON.stringify(decision)).digest("hex");
}

export function evaluateApprovalRequest(request: RecoveryApprovalRequest): RecoveryApprovalResult {
  if (!request.tenantId || !request.recoveryKey || !request.idempotencyKey || !request.actorId) {
    throw new Error("RECOVERY_APPROVAL_INPUT_INVALID");
  }
  if (request.decision.tenantId !== request.tenantId || request.decision.recoveryKey !== request.recoveryKey) {
    throw new Error("RECOVERY_APPROVAL_DECISION_SCOPE_MISMATCH");
  }
  if (request.decision.source !== "RECOVERY_STATE") {
    throw new Error("RECOVERY_APPROVAL_SOURCE_INVALID");
  }

  const decisionHash = hashRecoveryDecision(request.decision);
  const approved = request.action === "APPROVE";
  const executableDecision = request.decision.decision !== "NO_ACTION" && request.decision.requiresApproval;

  return {
    status: approved ? "APPROVED" : "REJECTED",
    approvalId: "pending",
    tenantId: request.tenantId,
    recoveryKey: request.recoveryKey,
    decision: request.decision.decision,
    decisionHash,
    action: request.action,
    executionPermission: approved && executableDecision ? "GRANTED" : "DENIED",
    approvedBy: request.actorId,
    approvedAt: new Date().toISOString(),
    reason: request.reason ?? null,
  };
}

export class InMemoryRecoveryApprovalGate implements RecoveryApprovalPort {
  private readonly approvals = new Map<string, { hash: string; result: RecoveryApprovalResult }>();

  async approve(request: RecoveryApprovalRequest): Promise<RecoveryApprovalResult> {
    const result = evaluateApprovalRequest(request);
    const existing = this.approvals.get(request.idempotencyKey);
    if (existing) {
      if (existing.hash !== result.decisionHash || existing.result.action !== result.action) {
        throw new ApprovalConflictError();
      }
      return { ...existing.result, status: "IDEMPOTENT" };
    }

    result.approvalId = crypto.randomUUID();
    this.approvals.set(request.idempotencyKey, { hash: result.decisionHash, result });
    return result;
  }
}

export async function submitRecoveryApproval(
  request: RecoveryApprovalRequest,
  gate: RecoveryApprovalPort,
): Promise<RecoveryApprovalResult> {
  return gate.approve(request);
}
