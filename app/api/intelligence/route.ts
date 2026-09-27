import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import {
  storeIntelligenceMemory,
  recallIntelligence,
  buildIntelligenceReflection,
} from "@/lib/intelligence-core";

function tenant(runtime: Awaited<ReturnType<typeof resolveSaaSContext>>) {
  return runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
}

export async function GET(request: Request) {
  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = tenant(runtime);
    if (!tenantId) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    if (!query) return NextResponse.json({ ok: true, memories: [] });
    const memories = await recallIntelligence({
      tenantId,
      query,
      domain: url.searchParams.get("domain") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 10),
    });
    return NextResponse.json({ ok: true, memories });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "INTELLIGENCE_RECALL_FAILED" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "intelligence");
  if (guard) return guard;
  const rl = rateLimit("intelligence:" + ((request.headers.get("x-forwarded-for") || "unknown").split(",")[0]));
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = tenant(runtime);
    if (!tenantId) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const operation = typeof body.operation === "string" ? body.operation : "";

    if (operation === "remember") {
      const memoryType = typeof body.memoryType === "string" ? body.memoryType : "OBSERVATION";
      const allowed = ["OBSERVATION","EXPERIENCE","LESSON","STRATEGY","FACT","BELIEF","OPINION","UNKNOWN","CONTRADICTION"];
      if (!allowed.includes(memoryType)) return NextResponse.json({ ok: false, error: "INVALID_MEMORY_TYPE" }, { status: 400 });
      if (typeof body.title !== "string" || typeof body.content !== "string") {
        return NextResponse.json({ ok: false, error: "TITLE_AND_CONTENT_REQUIRED" }, { status: 400 });
      }
      const memory = await storeIntelligenceMemory({
        tenantId, missionId: typeof body.missionId === "string" ? body.missionId : undefined,
        memoryType: memoryType as Parameters<typeof storeIntelligenceMemory>[0]["memoryType"],
        title: body.title, content: body.content, domain: typeof body.domain === "string" ? body.domain : undefined,
        confidence: typeof body.confidence === "number" ? body.confidence : undefined,
        source: typeof body.source === "string" ? body.source : "CORE_ENGINE",
        sourceRef: typeof body.sourceRef === "string" ? body.sourceRef : undefined,
        tags: Array.isArray(body.tags) ? body.tags.filter((x): x is string => typeof x === "string").slice(0,20) : undefined,
        metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : undefined,
      });
      return NextResponse.json({ ok: true, memory });
    }

    if (operation === "reflect") {
      if (typeof body.problem !== "string") return NextResponse.json({ ok: false, error: "PROBLEM_REQUIRED" }, { status: 400 });
      const result = await buildIntelligenceReflection({
        tenantId, missionId: typeof body.missionId === "string" ? body.missionId : undefined,
        problem: body.problem, hypothesis: typeof body.hypothesis === "string" ? body.hypothesis : undefined,
        decision: typeof body.decision === "string" ? body.decision : undefined,
        action: typeof body.action === "string" ? body.action : undefined,
        expected: body.expected && typeof body.expected === "object" ? body.expected as { before?: number; target?: number; direction?: "higher"|"lower" } : undefined,
        actual: body.actual && typeof body.actual === "object" ? body.actual as { before?: number; after?: number; direction?: "higher"|"lower" } : undefined,
        failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
        recoveryAction: typeof body.recoveryAction === "string" ? body.recoveryAction : undefined,
        domain: typeof body.domain === "string" ? body.domain : undefined,
      });
      return NextResponse.json({ ok: true, reflection: result });
    }

    return NextResponse.json({ ok: false, error: "UNKNOWN_INTELLIGENCE_OPERATION" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "INTELLIGENCE_OPERATION_FAILED" }, { status: 400 });
  }
}