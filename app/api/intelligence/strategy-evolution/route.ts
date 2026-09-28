import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { proposeStrategyEvolution } from "@/lib/strategy-evolution";

function tenant(runtime: Awaited<ReturnType<typeof resolveSaaSContext>>) {
  return runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "intelligence-strategy-evolution");
  if (guard) return guard;
  const rl = rateLimit("intelligence-strategy-evolution:" + ((request.headers.get("x-forwarded-for") || "unknown").split(",")[0]));
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = tenant(runtime);
    if (!tenantId) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.strategyId !== "string" || typeof body.name !== "string" || typeof body.problemPattern !== "string") {
      return NextResponse.json({ ok: false, error: "STRATEGY_REQUIRED" }, { status: 400 });
    }
    const status = body.status === "ACTIVE" || body.status === "DEPRECATED" ? body.status : "EXPERIMENTAL";
    const proposal = await proposeStrategyEvolution(tenantId, {
      strategyId: body.strategyId, name: body.name, problemPattern: body.problemPattern,
      evidenceCount: typeof body.evidenceCount === "number" ? body.evidenceCount : 0,
      successRate: typeof body.successRate === "number" ? body.successRate : null,
      avgDeltaPct: typeof body.avgDeltaPct === "number" ? body.avgDeltaPct : null,
      confidence: typeof body.confidence === "number" ? body.confidence : null,
      status,
    });
    return NextResponse.json({ ok: true, proposal });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "STRATEGY_EVOLUTION_FAILED" }, { status: 400 });
  }
}
