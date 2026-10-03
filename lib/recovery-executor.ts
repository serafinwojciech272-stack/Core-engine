import { createHash } from "node:crypto";
import type { ExecutionPermissionResult } from "@/lib/recovery-execution-permission";

export type RecoveryExecutionAction = "RESUME" | "REPLAY" | "RECONCILE";
export type RecoveryExecutionStatus = "EXECUTED" | "NOOP" | "FAILED";

export type RecoveryExecutorInput = {
  tenantId: string;
  recoveryKey: string;
  permission: ExecutionPermissionResult;
  checkpoint: Record<string, unknown>;
  idempotencyKey: string;
};

export type RecoveryExecutionEvent = {
  executionId: string;
  tenantId: string;
  recoveryKey: string;
  action: RecoveryExecutionAction;
  status: RecoveryExecutionStatus;
  approvalId: string;
  decisionHash: string;
  executionHash: string;
  executedBy: string;
  executedAt: string;
};

export type RecoveryExecutorPort = {
  execute(input: RecoveryExecutorInput): Promise<RecoveryExecutionEvent>;
};

export class ExecutionPermissionDeniedError extends Error {
  constructor() { super("RECOVERY_EXECUTION_PERMISSION_DENIED"); }
}

export class ExecutionConflictError extends Error {
  constructor() { super("RECOVERY_EXECUTION_IDEMPOTENCY_CONFLICT"); }
}

function isAction(value: string): value is RecoveryExecutionAction {
  return value === "RESUME" || value === "REPLAY" || value === "RECONCILE";
}

function hashExecution(input: RecoveryExecutorInput) {
  return createHash("sha256").update(JSON.stringify({
    tenantId: input.tenantId,
    recoveryKey: input.recoveryKey,
    approvalId: input.permission.approvalId,
    decisionHash: input.permission.decisionHash,
    action: input.permission.decision,
    checkpoint: input.checkpoint,
  })).digest("hex");
}

export class InMemoryRecoveryExecutor implements RecoveryExecutorPort {
  private readonly executions = new Map<string, { hash: string; event: RecoveryExecutionEvent }>();

  async execute(input: RecoveryExecutorInput): Promise<RecoveryExecutionEvent> {
    const p = input.permission;
    if (p.tenantId !== input.tenantId || p.recoveryKey !== input.recoveryKey || p.executionPermission !== "GRANTED" || p.action !== "APPROVE" || !isAction(p.decision)) {
      throw new ExecutionPermissionDeniedError();
    }
    const executionHash = hashExecution(input);
    const existing = this.executions.get(input.idempotencyKey);
    if (existing) {
      if (existing.hash !== executionHash) throw new ExecutionConflictError();
      return existing.event;
    }
    const event: RecoveryExecutionEvent = {
      executionId: crypto.randomUUID(),
      tenantId: input.tenantId,
      recoveryKey: input.recoveryKey,
      action: p.decision,
      status: "EXECUTED",
      approvalId: p.approvalId,
      decisionHash: p.decisionHash,
      executionHash,
      executedBy: p.approvedBy,
      executedAt: new Date().toISOString(),
    };
    this.executions.set(input.idempotencyKey, { hash: executionHash, event });
    return event;
  }
}
