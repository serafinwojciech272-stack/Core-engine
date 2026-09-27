import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { storeIntelligenceMemory, recallIntelligence, buildIntelligenceReflection } from "@/lib/intelligence-core";
import { upsertKnowledgeClaim, relateKnowledgeClaims, openUnknown, resolveUnknown, recallKnowledge, buildWorldModel } from "@/lib/intelligence-knowledge";

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
    const domain = url.searchParams.get("domain") ?? undefined;
    if (!query) return NextResponse.json({ ok: true, memories: [], knowledge: [], unknowns: [] });
    const intelligence = await recallKnowledge({ tenantId, query, domain, limit: Number(url.searchParams.get("limit") ?? 10) });
    return NextResponse.json({ ok: true, ...intelligence });
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
      if (typeof body.title !== "string" || typeof body.content !== "string") return NextResponse.json({ ok: false, error: "TITLE_AND_CONTENT_REQUIRED" }, { status: 400 });
      const allowed = ["OBSERVATION","EXPERIENCE","LESSON","STRATEGY","FACT","BELIEF","OPINION","UNKNOWN","CONTRADICTION"];
      const memoryType = typeof body.memoryType === "string" ? body.memoryType : "OBSERVATION";
      if (!allowed.includes(memoryType)) return NextResponse.json({ ok: false, error: "INVALID_MEMORY_TYPE" }, { status: 400 });
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
        tenantId, missionId: typeof body.missionId === "string" ? body.missionId : undefined, problem: body.problem,
        hypothesis: typeof body.hypothesis === "string" ? body.hypothesis : undefined, decision: typeof body.decision === "string" ? body.decision : undefined,
        action: typeof body.action === "string" ? body.action : undefined,
        expected: body.expected && typeof body.expected === "object" ? body.expected as { before?: number; target?: number; direction?: "higher"|"lower" } : undefined,
        actual: body.actual && typeof body.actual === "object" ? body.actual as { before?: number; after?: number; direction?: "higher"|"lower" } : undefined,
        failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
        recoveryAction: typeof body.recoveryAction === "string" ? body.recoveryAction : undefined,
        domain: typeof body.domain === "string" ? body.domain : undefined,
      });
      return NextResponse.json({ ok: true, reflection: result });
    }

    if (operation === "claim") {
      if (typeof body.claim !== "string") return NextResponse.json({ ok: false, error: "CLAIM_REQUIRED" }, { status: 400 });
      const claim = await upsertKnowledgeClaim({
        tenantId, claim: body.claim, claimKey: typeof body.claimKey === "string" ? body.claimKey : undefined,
        domain: typeof body.domain === "string" ? body.domain : undefined, status: typeof body.status === "string" ? body.status as never : undefined,
        confidence: typeof body.confidence === "number" ? body.confidence : undefined,
        source: typeof body.source === "string" ? body.source : undefined, sourceRef: typeof body.sourceRef === "string" ? body.sourceRef : undefined,
        observedAt: typeof body.observedAt === "string" ? body.observedAt : undefined, verifiedAt: typeof body.verifiedAt === "string" ? body.verifiedAt : undefined,
        expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
      });
      return NextResponse.json({ ok: true, claim });
    }

    if (operation === "contradict") {
      if (typeof body.fromClaimId !== "string" || typeof body.toClaimId !== "string") return NextResponse.json({ ok: false, error: "CLAIM_IDS_REQUIRED" }, { status: 400 });
      const relation = await relateKnowledgeClaims({ tenantId, fromClaimId: body.fromClaimId, toClaimId: body.toClaimId, relationType: "CONTRADICTS", confidence: typeof body.confidence === "number" ? body.confidence : undefined });
      return NextResponse.json({ ok: true, relation });
    }

    if (operation === "unknown") {
      if (typeof body.question !== "string") return NextResponse.json({ ok: false, error: "QUESTION_REQUIRED" }, { status: 400 });
      const unknown = await openUnknown({ tenantId, question: body.question, domain: typeof body.domain === "string" ? body.domain : undefined, priority: typeof body.priority === "number" ? body.priority : undefined, evidenceRequired: Array.isArray(body.evidenceRequired) ? body.evidenceRequired : undefined });
      return NextResponse.json({ ok: true, unknown });
    }

    if (operation === "resolve_unknown") {
      if (typeof body.unknownId !== "string" || !body.resolution || typeof body.resolution !== "object" || Array.isArray(body.resolution)) return NextResponse.json({ ok: false, error: "UNKNOWN_RESOLUTION_REQUIRED" }, { status: 400 });
      const unknown = await resolveUnknown({ tenantId, unknownId: body.unknownId, resolution: body.resolution as Record<string, unknown>, confidence: typeof body.confidence === "number" ? body.confidence : undefined });
      return NextResponse.json({ ok: true, unknown });
    }

    if (operation === "world_model") {
      const world = await buildWorldModel({ tenantId, domain: typeof body.domain === "string" ? body.domain : undefined,
        goals: Array.isArray(body.goals) ? body.goals : undefined, constraints: Array.isArray(body.constraints) ? body.constraints : undefined,
        entities: Array.isArray(body.entities) ? body.entities : undefined, kpis: Array.isArray(body.kpis) ? body.kpis : undefined,
        priorities: Array.isArray(body.priorities) ? body.priorities : undefined, activeHypotheses: Array.isArray(body.activeHypotheses) ? body.activeHypotheses : undefined,
        assumptions: Array.isArray(body.assumptions) ? body.assumptions : undefined });
      return NextResponse.json({ ok: true, worldModel: world });
    }

    return NextResponse.json({ ok: false, error: "UNKNOWN_INTELLIGENCE_OPERATION" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "INTELLIGENCE_OPERATION_FAILED" }, { status: 400 });
  }
}