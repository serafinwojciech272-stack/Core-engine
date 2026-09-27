import { createHash } from "node:crypto";
import type {
  CapabilityAction,
  CapabilityExecutionError,
  CapabilityExecutionStatus,
  CapabilityFailureCategory,
  CapabilitySideEffectStatus
} from "@/lib/capability-contracts";
import { isRetryableFailureCategory } from "@/lib/capability-contracts";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { listCapabilityPacks } from "@/lib/capability-registry";
import { isObservationalAdapter } from "@/lib/capability-adapters";
import { resolveAdapterBoundary, withinRetryBudget } from "@/lib/capability-adapter-boundary";

export type { CapabilityExecutionStatus } from "@/lib/capability-contracts";

// Receipts are additive over the original adapter receipt shape: every field the
// M8.1 contract exposed is retained so existing readers keep working.
export type CapabilityExecutionReceipt = {
  executionId: string;
  missionId?: string;
  capabilityActionId: string;
  actionId: string;
  packId: string;
  adapterId?: string;
  attempt: number;
  status: CapabilityExecutionStatus;
  executionMode: "ADAPTER";
  startedAt: string;
  completedAt: string;
  sideEffect: boolean;
  sideEffectStatus: CapabilitySideEffectStatus;
  retryable: boolean;
  observationalOnly: boolean;
  message: string;
  duplicate?: boolean;
  error?: CapabilityExecutionError;
  output?: Record<string, unknown>;
};

type RegisteredAction = CapabilityAction & { packId: string };

type StoredExecution = { receipt: CapabilityExecutionReceipt; actionId: string };

const root = globalThis as typeof globalThis & { __coreCapabilityExecutions?: Map<string, StoredExecution> };
root.__coreCapabilityExecutions ??= new Map();
const executions = root.__coreCapabilityExecutions;

// Adapter errors can embed credentials (URLs, headers). Redact the common shapes
// before the message reaches a receipt or an API response.
export function redactSecrets(message: string) {
  return message
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 <redacted>")
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9]{12,}\b/g, "<redacted>")
    .replace(/([?&](?:apikey|api_key|access_token|token|key|secret)=)[^&\s]+/gi, "$1<redacted>")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "<redacted>");
}

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

// The execution identity is derived from the idempotency key when one is given,
// so every attempt for the same key reports the same executionId. Without a key
// each invocation is a distinct execution.
export function deriveExecutionId(missionId: string | undefined, idempotencyKey: string | undefined, actionId: string) {
  if (!idempotencyKey) return `exec-${crypto.randomUUID()}`;
  return "exec-" + createHash("sha256").update(`${missionId ?? "anon"}:${actionId}:${idempotencyKey}`).digest("hex").slice(0, 32);
}

function storageKey(missionId: string | undefined, idempotencyKey: string) {
  return `${missionId ?? "anon"}:${idempotencyKey}`;
}

function buildReceipt(input: {
  actionId: string;
  packId: string;
  executionId: string;
  missionId?: string;
  startedAt: string;
  status: CapabilityExecutionStatus;
  adapterId?: string;
  attempt: number;
  sideEffectStatus: CapabilitySideEffectStatus;
  retryable: boolean;
  observationalOnly: boolean;
  message: string;
  category?: CapabilityFailureCategory;
  output?: Record<string, unknown>;
  completedAt?: string;
}): CapabilityExecutionReceipt {
  const error = input.category
    ? { category: input.category, message: redactSecrets(input.message), retryable: input.retryable }
    : undefined;
  return {
    executionId: input.executionId,
    missionId: input.missionId,
    capabilityActionId: input.actionId,
    actionId: input.actionId,
    packId: input.packId,
    adapterId: input.adapterId,
    attempt: input.attempt,
    status: input.status,
    executionMode: "ADAPTER",
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? new Date().toISOString(),
    sideEffect: input.sideEffectStatus === "APPLIED" || input.sideEffectStatus === "UNKNOWN",
    sideEffectStatus: input.sideEffectStatus,
    retryable: input.retryable,
    observationalOnly: input.observationalOnly,
    message: redactSecrets(input.message),
    error,
    output: input.output
  };
}

// Deterministic adapter input/permission failures are not transient. Retrying
// them without changing the request cannot succeed, so they are never retried
// automatically. Everything else thrown by an adapter is treated as transient.
const NON_RETRYABLE_ADAPTER_ERRORS = [
  "URL_REQUIRED", "UNSUPPORTED_URL_PROTOCOL", "PRIVATE_URL_BLOCKED",
  "WEBHOOK_ALLOWLIST_NOT_CONFIGURED", "WEBHOOK_TARGET_NOT_ALLOWLISTED",
  "WEBHOOK_METHOD_NOT_ALLOWED", "IDEMPOTENCY_KEY_REQUIRED"
] as const;

function classifyAdapterError(error: unknown): { category: CapabilityFailureCategory; message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : "Capability adapter execution failed.";
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError" || /timeout|timed out|aborted/i.test(message)) {
    return { category: "EXECUTION_TIMEOUT", message: "Capability adapter exceeded its execution timeout.", retryable: true };
  }
  if (NON_RETRYABLE_ADAPTER_ERRORS.some((code) => message.includes(code))) {
    return { category: "EXECUTION_FAILED", message, retryable: false };
  }
  return { category: "EXECUTION_FAILED", message, retryable: true };
}

export async function executeCapabilityAction(input: {
  actionId: string;
  approved: boolean;
  missionId?: string;
  idempotencyKey?: string;
  input?: Record<string, unknown>;
  attempt?: number;
  timeoutMs?: number;
}): Promise<CapabilityExecutionReceipt> {
  const startedAt = new Date().toISOString();
  const executionId = deriveExecutionId(input.missionId, input.idempotencyKey, input.actionId);
  const action = getCapabilityAction(input.actionId);

  if (!action) {
    return buildReceipt({
      actionId: input.actionId, packId: "unknown", executionId, missionId: input.missionId, startedAt,
      status: "NOT_FOUND", category: "CAPABILITY_NOT_FOUND", attempt: 1, sideEffectStatus: "NONE",
      retryable: false, observationalOnly: false, message: "Capability action is not registered."
    });
  }

  // Idempotency is evaluated before approval so a replayed request cannot be
  // converted into a fresh execution by re-supplying approval.
  const stored = input.idempotencyKey ? executions.get(storageKey(input.missionId, input.idempotencyKey)) : undefined;
  if (stored && stored.actionId !== input.actionId) {
    return buildReceipt({
      actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
      status: "IDEMPOTENCY_CONFLICT", category: "IDEMPOTENCY_CONFLICT", attempt: stored.receipt.attempt,
      sideEffectStatus: "NONE", retryable: false, observationalOnly: false,
      message: "Idempotency key was already used for a different capability action."
    });
  }
  if (stored) {
    if (stored.receipt.status === "EXECUTED") {
      return { ...stored.receipt, duplicate: true, sideEffect: false, sideEffectStatus: "NONE", message: "Idempotent replay: the action already executed successfully; no new side effect was produced." };
    }
    if (stored.receipt.status === "EXECUTING") {
      return buildReceipt({
        actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
        status: "IDEMPOTENCY_CONFLICT", category: "IDEMPOTENCY_CONFLICT", attempt: stored.receipt.attempt,
        adapterId: stored.receipt.adapterId, sideEffectStatus: "NONE", retryable: false,
        observationalOnly: stored.receipt.observationalOnly,
        message: "An execution with this idempotency key is already in flight."
      });
    }
    if (stored.receipt.status === "FAILED" || stored.receipt.status === "BLOCKED") {
      // A terminal, non-retryable failure must never be retried automatically.
      return buildReceipt({
        actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
        status: "BLOCKED", category: "EXECUTION_BLOCKED", attempt: stored.receipt.attempt,
        adapterId: stored.receipt.adapterId, sideEffectStatus: "NONE", retryable: false,
        observationalOnly: stored.receipt.observationalOnly,
        message: "Retry refused: the previous execution failed with a non-retryable error and requires human review."
      });
    }
    // A previous RETRYABLE failure may be retried; fall through to a new attempt.
  }

  if (action.requiresApproval && !input.approved) {
    return buildReceipt({
      actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
      status: "APPROVAL_REQUIRED", category: "APPROVAL_REQUIRED", attempt: 1, sideEffectStatus: "NONE",
      retryable: false, observationalOnly: false,
      message: "Explicit capability approval is required before the adapter can execute."
    });
  }

  const resolution = resolveAdapterBoundary(action);
  if (!resolution.ok) {
    if (resolution.reason === "ADAPTER_NOT_FOUND") {
      return buildReceipt({
        actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
        status: "ADAPTER_NOT_FOUND", category: "ADAPTER_NOT_FOUND", attempt: 1, sideEffectStatus: "NONE",
        retryable: false, observationalOnly: false,
        message: "No registered execution adapter supports this capability action."
      });
    }
    // The adapter exists but its credential boundary is not configured. This is a
    // deterministic, non-retryable refusal made before any external call.
    return buildReceipt({
      actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
      status: "FAILED", category: "EXECUTION_BLOCKED", attempt: 1, adapterId: resolution.boundary?.adapterId,
      sideEffectStatus: "NONE", retryable: false, observationalOnly: Boolean(resolution.boundary?.observationalOnly),
      message: "Adapter credential boundary is not configured; execution was refused before any external call."
    });
  }
  const { adapter, policy: adapterPolicy } = resolution;

  const observationalOnly = isObservationalAdapter(adapter);
  const attempt = Math.max(1, input.attempt ?? (stored ? stored.receipt.attempt + 1 : 1));
  // A stored retryable failure may only be retried while the adapter's bounded
  // retry budget allows it; otherwise the attempt is blocked deterministically.
  if (stored && stored.receipt.status === "RETRYABLE" && !withinRetryBudget(adapterPolicy, attempt)) {
    return buildReceipt({
      actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
      status: "BLOCKED", category: "EXECUTION_BLOCKED", attempt: stored.receipt.attempt,
      adapterId: adapter.id, sideEffectStatus: "NONE", retryable: false, observationalOnly,
      message: "Retry refused: the adapter's bounded retry budget is exhausted."
    });
  }
  const timeoutMs = input.timeoutMs ?? adapterPolicy.timeoutMs;
  const key = input.idempotencyKey ? storageKey(input.missionId, input.idempotencyKey) : null;

  const store = (value: CapabilityExecutionReceipt) => {
    if (key) executions.set(key, { actionId: action.id, receipt: value });
    return value;
  };

  if (key) {
    executions.set(key, {
      actionId: action.id,
      receipt: buildReceipt({
        actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
        status: "EXECUTING", adapterId: adapter.id, attempt, sideEffectStatus: "NONE", retryable: false,
        observationalOnly, message: "Adapter execution in progress."
      })
    });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      adapter.execute(action, { missionId: input.missionId, idempotencyKey: input.idempotencyKey, attempt, input: input.input }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("Capability adapter exceeded its execution timeout.");
          error.name = "TimeoutError";
          reject(error);
        }, timeoutMs);
      })
    ]);

    const sideEffect = result.sideEffect === true;
    if (observationalOnly && sideEffect) {
      // Fail closed: an observational-only adapter must never produce a side effect.
      return store(buildReceipt({
        actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
        status: "BLOCKED", category: "EXECUTION_BLOCKED", attempt, adapterId: adapter.id,
        sideEffectStatus: "APPLIED", retryable: false, observationalOnly,
        message: "Observational-only adapter reported a side effect; the result was rejected."
      }));
    }

    if (result.status === "EXECUTED") {
      return store(buildReceipt({
        actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
        status: "EXECUTED", attempt, adapterId: adapter.id,
        sideEffectStatus: sideEffect ? "APPLIED" : "NONE", retryable: false, observationalOnly,
        message: result.message, output: result.output,
        completedAt: result.completedAt
      }));
    }

    const category: CapabilityFailureCategory = result.errorCategory
      ?? (result.status === "REJECTED" ? "EXECUTION_BLOCKED" : "EXECUTION_FAILED");
    // A failed attempt that already produced a side effect must not be retried
    // automatically, otherwise the side effect could be duplicated.
    const failureSideEffect: CapabilitySideEffectStatus = sideEffect ? "APPLIED" : "NONE";
    const retryable = isRetryableFailureCategory(category) && (result.retryable ?? true) && failureSideEffect === "NONE";
    const status: CapabilityExecutionStatus = category === "EXECUTION_BLOCKED" ? "BLOCKED" : retryable ? "RETRYABLE" : "FAILED";
    return store(buildReceipt({
      actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
      status, category, attempt, adapterId: adapter.id, sideEffectStatus: failureSideEffect,
      retryable, observationalOnly, message: result.message, output: result.output
    }));
  } catch (error) {
    const { category, message, retryable: transient } = classifyAdapterError(error);
    // A timeout on a side-effecting adapter leaves the side effect unknown, so an
    // automatic retry could duplicate it. Retry is only safe when it cannot.
    const sideEffectStatus: CapabilitySideEffectStatus = category === "EXECUTION_TIMEOUT" && !observationalOnly ? "UNKNOWN" : "NONE";
    const retryable = transient && isRetryableFailureCategory(category) && sideEffectStatus === "NONE";
    const status: CapabilityExecutionStatus = retryable ? "RETRYABLE" : category === "EXECUTION_TIMEOUT" ? "BLOCKED" : "FAILED";
    return store(buildReceipt({
      actionId: action.id, packId: action.packId, executionId, missionId: input.missionId, startedAt,
      status, category, attempt, adapterId: adapter.id, sideEffectStatus,
      retryable, observationalOnly, message
    }));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Read-only accessor used by tests and the measurement layer.
export function getStoredCapabilityExecution(missionId: string | undefined, idempotencyKey: string) {
  return executions.get(storageKey(missionId, idempotencyKey))?.receipt ?? null;
}

// Single deterministic mapping from an execution receipt to the transport
// contract, so every capability execution endpoint reports the same codes.
export type CapabilityOutcome = { ok: boolean; attempted: boolean; retryBlocked: boolean; error?: string; httpStatus: number };

export function classifyCapabilityReceipt(receipt: CapabilityExecutionReceipt): CapabilityOutcome {
  switch (receipt.status) {
    case "EXECUTED":
      return { ok: true, attempted: true, retryBlocked: false, httpStatus: 200 };
    case "NOT_FOUND":
      return { ok: false, attempted: false, retryBlocked: false, error: "CAPABILITY_ACTION_NOT_FOUND", httpStatus: 404 };
    case "APPROVAL_REQUIRED":
      return { ok: false, attempted: false, retryBlocked: false, error: "CAPABILITY_APPROVAL_REQUIRED", httpStatus: 403 };
    case "ADAPTER_NOT_FOUND":
      return { ok: false, attempted: false, retryBlocked: false, error: "CAPABILITY_ADAPTER_NOT_FOUND", httpStatus: 501 };
    case "IDEMPOTENCY_CONFLICT":
      return { ok: false, attempted: false, retryBlocked: true, error: "CAPABILITY_IDEMPOTENCY_CONFLICT", httpStatus: 409 };
    case "BLOCKED":
      return { ok: false, attempted: true, retryBlocked: true, error: "CAPABILITY_EXECUTION_BLOCKED", httpStatus: 409 };
    case "RETRYABLE":
      return { ok: false, attempted: true, retryBlocked: false, error: "CAPABILITY_EXECUTION_FAILED", httpStatus: 502 };
    case "FAILED":
      return { ok: false, attempted: true, retryBlocked: false, error: "CAPABILITY_EXECUTION_FAILED", httpStatus: 502 };
    default:
      return { ok: false, attempted: true, retryBlocked: false, error: "CAPABILITY_EXECUTION_FAILED", httpStatus: 502 };
  }
}
