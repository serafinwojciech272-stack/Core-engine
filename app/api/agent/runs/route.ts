import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { getRunStore } from "@/lib/agent-loop/store";
import { newRun } from "@/lib/agent-loop/runner";
import { describeLlmConfig } from "@/lib/agent-loop/llm";
import { renderPlaybook } from "@/lib/agent-loop/playbooks";
import { kickInlineWorker, workerMode } from "@/lib/agent-loop/worker";
import { clampBudget, errorStatus, publicRun, requireTenant } from "@/lib/agent-loop/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 120_000;

// POST /api/agent/runs — enqueue a long-running agent run; returns 202 immediately.
// Body: { goal, acceptanceCriteria?, context?, budget?, requires? } or { playbookId, inputs, sandbox?, budget? }.
export async function POST(request: Request) {
  const guard = guardMutation(request, "agent-runs");
  if (guard) return guard;
  try {
    const tenantId = await requireTenant(request);
    const llm = describeLlmConfig();
    if (!llm.configured) return NextResponse.json({ ok: false, error: "AGENT_LLM_NOT_CONFIGURED", detail: llm.issue }, { status: 503 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    let body: Record<string, unknown>;
    try { body = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 }); }
    let run;
    if (typeof body.playbookId === "string") {
      const p = renderPlaybook(body.playbookId, body.inputs, { sandbox: body.sandbox === true });
      // Operator budget wins over the playbook default, both clamped to server limits.
      run = newRun({ tenantId, goal: p.goal, context: p.context, acceptanceCriteria: p.acceptanceCriteria, requires: p.requires, playbookId: p.playbookId, budget: clampBudget({ ...p.budget, ...(body.budget && typeof body.budget === "object" ? body.budget : {}) }) });
    } else {
      if (typeof body.goal !== "string" || body.goal.length > 12_000) return NextResponse.json({ ok: false, error: "GOAL_REQUIRED" }, { status: 400 });
      run = newRun({
        tenantId, goal: body.goal,
        context: typeof body.context === "string" ? body.context : undefined,
        acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria.map(String) : [],
        budget: clampBudget(body.budget), requires: body.requires,
      });
    }
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
    return NextResponse.json({ ok: true, runs: runs.map((r) => ({ id: r.id, status: r.status, goal: r.goal.slice(0, 200), usage: r.usage, playbookId: r.playbookId ?? null, requires: r.requires ?? [], createdAt: r.createdAt, updatedAt: r.updatedAt })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_RUN_LIST_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
