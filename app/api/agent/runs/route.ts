import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { getRunStore } from "@/lib/agent-loop/store";
import { newRun } from "@/lib/agent-loop/runner";
import { createLlmClientFromEnv } from "@/lib/agent-loop/llm";
import { kickInlineWorker, workerMode } from "@/lib/agent-loop/worker";
import { clampBudget, errorStatus, publicRun, requireTenant } from "@/lib/agent-loop/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 120_000;

// POST /api/agent/runs — enqueue a long-running agent run; returns 202 immediately.
export async function POST(request: Request) {
  const guard = guardMutation(request, "agent-runs");
  if (guard) return guard;
  try {
    const tenantId = await requireTenant(request);
    if (!createLlmClientFromEnv()) return NextResponse.json({ ok: false, error: "AGENT_LLM_NOT_CONFIGURED" }, { status: 503 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    let body: Record<string, unknown>;
    try { body = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 }); }
    if (typeof body.goal !== "string" || body.goal.length > 12_000) return NextResponse.json({ ok: false, error: "GOAL_REQUIRED" }, { status: 400 });
    const run = newRun({
      tenantId, goal: body.goal,
      context: typeof body.context === "string" ? body.context : undefined,
      acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria.map(String) : [],
      budget: clampBudget(body.budget),
    });
    await getRunStore().create(run);
    kickInlineWorker();
    return NextResponse.json({ ok: true, run: publicRun(run), pollUrl: `/api/agent/runs/${run.id}`, worker: workerMode() }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_RUN_CREATE_FAILED";
    if (errorStatus(message) >= 500) console.error("[agent-runs] create failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}

// GET /api/agent/runs — latest runs of the caller's tenant.
export async function GET(request: Request) {
  try {
    const tenantId = await requireTenant(request);
    const runs = await getRunStore().list(tenantId, 50);
    return NextResponse.json({ ok: true, runs: runs.map((r) => ({ id: r.id, status: r.status, goal: r.goal.slice(0, 200), usage: r.usage, updatedAt: r.updatedAt })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_RUN_LIST_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
