import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { getRunStore } from "@/lib/agent-loop/store";
import { cancelRun, decideApproval, resumeRun } from "@/lib/agent-loop/runner";
import { kickInlineWorker } from "@/lib/agent-loop/worker";
import { clampBudget, errorStatus, publicRun, requireTenant } from "@/lib/agent-loop/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agent/runs/:id[?messages=1] — status, progress, steps, artifacts (poll this).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await requireTenant(request);
    const { id } = await params;
    const run = await getRunStore().get(id);
    if (!run || run.tenantId !== tenantId) return NextResponse.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });
    const url = new URL(request.url);
    const artifactId = url.searchParams.get("artifact");
    if (artifactId) {
      const artifact = run.artifacts.find((a) => a.id === artifactId);
      if (!artifact) return NextResponse.json({ ok: false, error: "ARTIFACT_NOT_FOUND" }, { status: 404 });
      return NextResponse.json({ ok: true, artifact }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: true, run: publicRun(run, url.searchParams.get("messages") === "1") }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_RUN_READ_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}

// POST /api/agent/runs/:id  { action: "approve" | "reject" | "cancel" | "resume", budget? }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = guardMutation(request, "agent-runs");
  if (guard) return guard;
  try {
    const tenantId = await requireTenant(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { action?: string; budget?: unknown };
    const store = getRunStore();
    let run;
    if (body.action === "approve" || body.action === "reject") run = await decideApproval(store, id, tenantId, body.action === "approve" ? "APPROVED" : "REJECTED");
    else if (body.action === "cancel") run = await cancelRun(store, id, tenantId);
    else if (body.action === "resume") run = await resumeRun(store, id, tenantId, clampBudget(body.budget));
    else return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
    if (run.status === "QUEUED") kickInlineWorker();
    return NextResponse.json({ ok: true, run: publicRun(run) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_RUN_ACTION_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
