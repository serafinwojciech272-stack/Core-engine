import type { CapabilityAction } from "@/lib/capability-contracts";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { listCapabilityPacks } from "@/lib/capability-registry";
import { resolveCapabilityAdapter } from "@/lib/capability-adapters";

export type CapabilityExecutionStatus = "EXECUTED" | "APPROVAL_REQUIRED" | "NOT_FOUND" | "ADAPTER_NOT_FOUND" | "FAILED";

export type CapabilityExecutionReceipt = {
  actionId: string;
  packId: string;
  status: CapabilityExecutionStatus;
  executionMode: "ADAPTER";
  adapterId?: string;
  startedAt: string;
  completedAt: string;
  sideEffect: boolean;
  message: string;
  output?: Record<string, unknown>;
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

export async function executeCapabilityAction(input: {
  actionId: string;
  approved: boolean;
  missionId?: string;
  idempotencyKey?: string;
  input?: Record<string, unknown>;
}): Promise<CapabilityExecutionReceipt> {
  const action = getCapabilityAction(input.actionId);
  const startedAt = new Date().toISOString();
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

  const adapter = resolveCapabilityAdapter(action);
  if (!adapter) {
    return {
      actionId: action.id,
      packId: action.packId,
      status: "ADAPTER_NOT_FOUND",
      executionMode: "ADAPTER",
      startedAt,
      completedAt: new Date().toISOString(),
      sideEffect: false,
      message: "No registered execution adapter supports this capability action."
    };
  }

  try {
    const result = await adapter.execute(action, {
      missionId: input.missionId,
      idempotencyKey: input.idempotencyKey,
      input: input.input
    });
    return {
      actionId: action.id,
      packId: action.packId,
      status: result.status === "EXECUTED" ? "EXECUTED" : "FAILED",
      executionMode: "ADAPTER",
      adapterId: adapter.id,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      sideEffect: result.sideEffect,
      message: result.message,
      output: result.output
    };
  } catch (error) {
    return {
      actionId: action.id,
      packId: action.packId,
      status: "FAILED",
      executionMode: "ADAPTER",
      adapterId: adapter.id,
      startedAt,
      completedAt: new Date().toISOString(),
      sideEffect: false,
      message: error instanceof Error ? error.message : "Capability adapter execution failed."
    };
  }
}
