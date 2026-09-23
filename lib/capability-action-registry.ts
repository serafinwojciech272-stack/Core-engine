import type { CapabilityAction } from "@/lib/capability-contracts";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { listCapabilityPacks } from "@/lib/capability-registry";

export type CapabilityExecutionStatus = "EXECUTED" | "APPROVAL_REQUIRED" | "NOT_FOUND";

export type CapabilityExecutionReceipt = {
  actionId: string;
  packId: string;
  status: CapabilityExecutionStatus;
  executionMode: "ADAPTER";
  startedAt: string;
  completedAt: string;
  sideEffect: false;
  message: string;
};

type RegisteredAction = CapabilityAction & { packId: string };

function allActions(): RegisteredAction[] {
  ensureCapabilityPacks();
  return listCapabilityPacks().flatMap((pack) =>
    pack.actions.map((action) => ({ ...action, packId: pack.id }))
  );
}

export function getCapabilityAction(actionId: string): RegisteredAction | null {
  return allActions().find((action) => action.id === actionId) ?? null;
}

export function listCapabilityActions(): RegisteredAction[] {
  return allActions();
}

/**
 * Execution fabric boundary.
 * It intentionally produces an execution receipt without performing an external side effect.
 * Real integrations attach adapters here later, while mission policy/idempotency remains upstream.
 */
export function executeCapabilityAction(input: {
  actionId: string;
  approved: boolean;
}): CapabilityExecutionReceipt {
  const startedAt = new Date().toISOString();
  const action = getCapabilityAction(input.actionId);
  if (!action) {
    return {
      actionId: input.actionId,
      packId: "unknown",
      status: "NOT_FOUND",
      executionMode: "ADAPTER",
      startedAt,
      completedAt: new Date().toISOString(),
      sideEffect: false,
      message: "Capability action is not registered."
    };
  }

  if (action.requiresApproval && !input.approved) {
    return {
      actionId: action.id,
      packId: action.packId,
      status: "APPROVAL_REQUIRED",
      executionMode: "ADAPTER",
      startedAt,
      completedAt: new Date().toISOString(),
      sideEffect: false,
      message: "Explicit capability approval is required before the adapter can execute."
    };
  }

  return {
    actionId: action.id,
    packId: action.packId,
    status: "EXECUTED",
    executionMode: "ADAPTER",
    startedAt,
    completedAt: new Date().toISOString(),
    sideEffect: false,
    message: "Execution adapter accepted the action. No external side effect is performed by the core fabric."
  };
}
