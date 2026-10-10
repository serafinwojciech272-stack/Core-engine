// Shared request helpers for /api/agent/runs routes.
import { authorizeTenant } from "@/lib/http";
import type { AgentRun, RunBudget } from "@/lib/agent-loop/contracts";

/** Long runs spend real money: always require a real identity, even in anonymous demo mode. */
export async function requireTenant(request: Request): Promise<string> {
  const auth = await authorizeTenant(request, { allowAnonymous: false });
  if (!auth.ok) throw new Error(auth.response.status === 401 ? "AUTH_REQUIRED" : "TENANT_CONTEXT_REQUIRED");
  return auth.tenantId;
}

const LIMITS: RunBudget = { maxSteps: 200, maxTokens: 4_000_000, maxCostUsd: 5, maxWallMs: 4 * 3_600_000, maxOutputTokensPerCall: 16_000 };

/** Clamps a client-supplied budget to server limits (AGENT_MAX_COST_PER_RUN_USD overrides the cost cap). */
export function clampBudget(input: unknown): Partial<RunBudget> {
  if (!input || typeof input !== "object") return {};
  const costCap = Number(process.env.AGENT_MAX_COST_PER_RUN_USD) > 0 ? Number(process.env.AGENT_MAX_COST_PER_RUN_USD) : LIMITS.maxCostUsd;
  const out: Partial<RunBudget> = {};
  for (const key of Object.keys(LIMITS) as Array<keyof RunBudget>) {
    const v = Number((input as Record<string, unknown>)[key]);
    if (Number.isFinite(v) && v > 0) out[key] = Math.min(v, key === "maxCostUsd" ? costCap : LIMITS[key]);
  }
  return out;
}

export function publicRun(run: AgentRun, includeMessages = false) {
  return {
    id: run.id, status: run.status, goal: run.goal, acceptanceCriteria: run.acceptanceCriteria,
    budget: run.budget, usage: run.usage, error: run.error ?? null,
    pendingApproval: run.pendingApproval ?? null, result: run.result ?? null,
    progress: { steps: run.steps.length, lastStep: run.steps.at(-1) ?? null, plan: run.workspace["PLAN.md"]?.slice(0, 4000) ?? null },
    steps: run.steps,
    artifacts: run.artifacts.map((a) => ({ id: a.id, name: a.name, type: a.type, mimeType: a.mimeType ?? null, provider: a.provider ?? null, createdAt: a.createdAt, size: (a.content?.length ?? 0) + (a.dataUrl?.length ?? 0) })),
    workspace: Object.fromEntries(Object.entries(run.workspace).map(([p, c]) => [p, { bytes: c.length }])),
    ...(includeMessages ? { messages: run.messages, workspaceFiles: run.workspace } : {}),
    createdAt: run.createdAt, updatedAt: run.updatedAt, version: run.version,
  };
}

export function errorStatus(message: string) {
  if (message === "AUTH_REQUIRED") return 401;
  if (message === "TENANT_CONTEXT_REQUIRED" || message === "TENANT_NOT_CONFIGURED") return 403;
  if (message === "RUN_NOT_FOUND") return 404;
  if (/^RUN_NOT_|RUN_VERSION_CONFLICT/.test(message)) return 409;
  if (/^(GOAL_REQUIRED|INVALID_)/.test(message)) return 400;
  return 503;
}
