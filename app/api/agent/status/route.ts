import { NextResponse } from "next/server";
import { clampBudget, errorStatus, requireTenant } from "@/lib/agent-loop/http";
import { describeLlmConfig } from "@/lib/agent-loop/llm";
import { runStoreKind } from "@/lib/agent-loop/store";
import { workerMode } from "@/lib/agent-loop/worker";
import { sandboxToolFromEnv } from "@/lib/agent-loop/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agent/status — what this deployment can do, without secrets (ADR-003).
// Also the panel's login check: a wrong operator key gets 401 here before anything else happens.
export async function GET(request: Request) {
  try {
    await requireTenant(request);
    const store = runStoreKind();
    return NextResponse.json({
      ok: true,
      llm: describeLlmConfig(),
      store: { kind: store, durable: store === "supabase" },
      worker: { mode: workerMode(), sandbox: Boolean(sandboxToolFromEnv()) },
      limits: { maxCostUsdPerRun: clampBudget({ maxCostUsd: Number.MAX_SAFE_INTEGER }).maxCostUsd ?? null },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "STATUS_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
