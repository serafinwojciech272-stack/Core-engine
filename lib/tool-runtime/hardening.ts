import type { ToolInvocation } from "./contracts";

export type RuntimeLifecycle = "PLANNED" | "APPROVED" | "EXECUTING" | "COMPLETED" | "FAILED" | "TIMED_OUT" | "BLOCKED";

export type RetryPolicy = {
  maxAttempts?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
};

export type TimeoutPolicy = {
  timeoutMs?: number;
};

export type CircuitPolicy = {
  failureThreshold?: number;
  cooldownMs?: number;
};

type CircuitState = { failures: number; openedAt?: number };

const idempotency = new Map<string, { invocationId: string; result: unknown }>();
const circuits = new Map<string, CircuitState>();

function keyOf(i: ToolInvocation) {
  return `${i.request.tenantId}:${i.request.toolId}:${i.request.missionId}:${i.request.idempotencyKey ?? i.invocationId}`;
}

export function runtimeTransition(current: RuntimeLifecycle, next: RuntimeLifecycle): RuntimeLifecycle {
  const allowed: Record<RuntimeLifecycle, RuntimeLifecycle[]> = {
    PLANNED: ["APPROVED", "BLOCKED"],
    APPROVED: ["EXECUTING", "BLOCKED"],
    EXECUTING: ["COMPLETED", "FAILED", "TIMED_OUT"],
    COMPLETED: [],
    FAILED: [],
    TIMED_OUT: [],
    BLOCKED: [],
  };
  if (!allowed[current].includes(next)) throw new Error(`INVALID_RUNTIME_TRANSITION:${current}->${next}`);
  return next;
}

export function getIdempotentResult(i: ToolInvocation) {
  return i.request.idempotencyKey ? idempotency.get(keyOf(i)) : undefined;
}

export function rememberIdempotentResult(i: ToolInvocation, result: unknown) {
  if (i.request.idempotencyKey) idempotency.set(keyOf(i), { invocationId: i.invocationId, result });
}

export function clearRuntimeState() {
  idempotency.clear();
  circuits.clear();
}

export function assertCircuitClosed(toolId: string, policy: CircuitPolicy = {}, now = Date.now()) {
  const state = circuits.get(toolId);
  const cooldownMs = policy.cooldownMs ?? 30_000;
  if (!state) return;
  if (state.openedAt && now - state.openedAt >= cooldownMs) {
    circuits.delete(toolId);
    return;
  }
  if (state.openedAt) throw new Error("CIRCUIT_OPEN");
}

export function recordCircuitSuccess(toolId: string) {
  circuits.delete(toolId);
}

export function recordCircuitFailure(toolId: string, policy: CircuitPolicy = {}, now = Date.now()) {
  const threshold = Math.max(1, policy.failureThreshold ?? 3);
  const state = circuits.get(toolId) ?? { failures: 0 };
  state.failures += 1;
  if (state.failures >= threshold) state.openedAt = now;
  circuits.set(toolId, state);
}

export async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("TOOL_TIMEOUT"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryable(error: unknown) {
  const message = String(error);
  return /TIMEOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|429|503|502/i.test(message);
}

export async function withRetry<T>(
  work: () => Promise<T>,
  policy: RetryPolicy = {},
): Promise<T> {
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 2);
  const base = Math.max(0, policy.backoffMs ?? 100);
  const maxBackoff = Math.max(base, policy.maxBackoffMs ?? 2_000);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryable(error)) throw error;
      const delay = Math.min(maxBackoff, base * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
