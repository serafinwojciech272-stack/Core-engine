import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { storeIntelligenceMemory, recallIntelligence, buildIntelligenceReflection } from "@/lib/intelligence-core";
import { upsertWorldEntity, addWorldClaim, openWorldUnknown, resolveWorldUnknown, getWorldContext, buildWorldSnapshot } from "@/lib/world-model";
import { classifyFailure, recordFailureLearning } from "@/lib/failure-recovery-learning";
import { generalizeRecoveryPattern, recallRecoveryPatterns } from "@/lib/recovery-pattern-generalization";
import { consolidateLearning } from "@/lib/learning-consolidation";
import { evaluateLearningQuality } from "@/lib/learning-quality-gate";

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
    const [memories, world] = await Promise.all([recallIntelligence({ tenantId, query, domain, limit: Number(url.searchParams.get("limit") ?? 10) }), getWorldContext({ tenantId, domain, limit: Number(url.searchParams.get("limit") ?? 10) })]);
    return NextResponse.json({ ok: true, memories, knowledge: world.claims, unknowns: world.unknowns, contradictions: world.contradictions });
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

    if (operation === "failure") {
      if (typeof body.problem !== "string") return NextResponse.json({ ok: false, error: "PROBLEM_REQUIRED" }, { status: 400 });
      const failureType = typeof body.failureType === "string" ? body.failureType as Parameters<typeof recordFailureLearning>[0]["failureType"] : classifyFailure({
        failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
        failedAction: typeof body.failedAction === "string" ? body.failedAction : undefined,
        errorCode: typeof body.errorCode === "string" ? body.errorCode : undefined,
      });
      const result = await recordFailureLearning({
        tenantId, missionId: typeof body.missionId === "string" ? body.missionId : undefined,
        experienceId: typeof body.experienceId === "string" ? body.experienceId : undefined,
        problem: body.problem, failureType,
        rootCause: typeof body.rootCause === "string" ? body.rootCause : undefined,
        severity: typeof body.severity === "string" ? body.severity as Parameters<typeof recordFailureLearning>[0]["severity"] : undefined,
        failedAction: typeof body.failedAction === "string" ? body.failedAction : undefined,
        failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
        recoveryAction: typeof body.recoveryAction === "string" ? body.recoveryAction : undefined,
        recoveryResult: typeof body.recoveryResult === "string" ? body.recoveryResult : undefined,
        recoverySuccess: typeof body.recoverySuccess === "boolean" ? body.recoverySuccess : null,
        recoveryDeltaPct: typeof body.recoveryDeltaPct === "number" ? body.recoveryDeltaPct : null,
        evidence: Array.isArray(body.evidence) ? body.evidence : undefined,
        prevention: Array.isArray(body.prevention) ? body.prevention : undefined,
        confidence: typeof body.confidence === "number" ? body.confidence : undefined,
      });
      return NextResponse.json({ ok: true, failureLearning: result });
    }

    if (operation === "recovery_pattern") {
      if (typeof body.recoveryAction !== "string") return NextResponse.json({ ok: false, error: "RECOVERY_ACTION_REQUIRED" }, { status: 400 });
      const pattern = await generalizeRecoveryPattern({ tenantId, problem: typeof body.problem === "string" ? body.problem : "", failureType: typeof body.failureType === "string" ? body.failureType as Parameters<typeof generalizeRecoveryPattern>[0]["failureType"] : undefined, failedAction: typeof body.failedAction === "string" ? body.failedAction : undefined, failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined, recoveryAction: body.recoveryAction, recoveryResult: typeof body.recoveryResult === "string" ? body.recoveryResult : undefined, recoverySuccess: typeof body.recoverySuccess === "boolean" ? body.recoverySuccess : null, recoveryDeltaPct: typeof body.recoveryDeltaPct === "number" ? body.recoveryDeltaPct : null, preconditions: Array.isArray(body.preconditions) ? body.preconditions.filter((x): x is string => typeof x === "string") : undefined, failureId: typeof body.failureId === "string" ? body.failureId : undefined });
      return NextResponse.json({ ok: true, recoveryPattern: pattern });
    }

    if (operation === "recovery_patterns") {
      const patterns = await recallRecoveryPatterns({ tenantId, failureType: typeof body.failureType === "string" ? body.failureType as Parameters<typeof recallRecoveryPatterns>[0]["failureType"] : undefined, query: typeof body.query === "string" ? body.query : undefined, limit: typeof body.limit === "number" ? body.limit : undefined });
      return NextResponse.json({ ok: true, recoveryPatterns: patterns });
    }

    if (operation === "learning_consolidate") {
      const result = await consolidateLearning({
        tenantId,
        domain: typeof body.domain === "string" ? body.domain : undefined,
        limit: typeof body.limit === "number" ? body.limit : undefined,
      });
      return NextResponse.json({ ok: true, consolidation: result });
    }

    if (operation === "learning_quality") {
      const result = evaluateLearningQuality({
        baselineSuccessRate: typeof body.baselineSuccessRate === "number" ? body.baselineSuccessRate : null,
        candidateSuccessRate: typeof body.candidateSuccessRate === "number" ? body.candidateSuccessRate : null,
        baselineAvgDeltaPct: typeof body.baselineAvgDeltaPct === "number" ? body.baselineAvgDeltaPct : null,
        candidateAvgDeltaPct: typeof body.candidateAvgDeltaPct === "number" ? body.candidateAvgDeltaPct : null,
        evidenceCount: typeof body.evidenceCount === "number" ? body.evidenceCount : 0,
      });
      return NextResponse.json({ ok: true, evaluation: result });
    }

    if (operation === "entity") {
      if (typeof body.entityType !== "string" || typeof body.canonicalName !== "string") return NextResponse.json({ ok: false, error: "ENTITY_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, entity: await upsertWorldEntity({ tenantId, entityType: body.entityType, canonicalName: body.canonicalName, attributes: body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes) ? body.attributes as Record<string,unknown> : undefined, confidence: typeof body.confidence === "number" ? body.confidence : undefined, source: typeof body.source === "string" ? body.source : undefined, sourceRef: typeof body.sourceRef === "string" ? body.sourceRef : undefined }) });
    }

    if (operation === "claim") {
      if (typeof body.subjectKey !== "string" || typeof body.predicate !== "string") return NextResponse.json({ ok: false, error: "CLAIM_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, ...await addWorldClaim({ tenantId, subjectKey: body.subjectKey, predicate: body.predicate, objectValue: body.objectValue, domain: typeof body.domain === "string" ? body.domain : undefined, confidence: typeof body.confidence === "number" ? body.confidence : undefined, source: typeof body.source === "string" ? body.source : undefined, sourceRef: typeof body.sourceRef === "string" ? body.sourceRef : undefined, observedAt: typeof body.observedAt === "string" ? body.observedAt : undefined, validUntil: typeof body.validUntil === "string" ? body.validUntil : undefined, subjectEntityId: typeof body.subjectEntityId === "string" ? body.subjectEntityId : undefined }) });
    }

    if (operation === "unknown") {
      if (typeof body.domain !== "string" || typeof body.question !== "string") return NextResponse.json({ ok: false, error: "UNKNOWN_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, unknown: await openWorldUnknown({ tenantId, domain: body.domain, question: body.question, key: typeof body.key === "string" ? body.key : undefined, importance: typeof body.importance === "string" ? body.importance as "LOW"|"MEDIUM"|"HIGH"|"CRITICAL" : undefined, evidenceNeeded: Array.isArray(body.evidenceNeeded) ? body.evidenceNeeded : undefined, discoveredFrom: body.discoveredFrom && typeof body.discoveredFrom === "object" && !Array.isArray(body.discoveredFrom) ? body.discoveredFrom as Record<string,unknown> : undefined, confidence: typeof body.confidence === "number" ? body.confidence : undefined }) });
    }

    if (operation === "resolve_unknown") {
      if (typeof body.unknownId !== "string" || typeof body.claimId !== "string") return NextResponse.json({ ok: false, error: "UNKNOWN_RESOLUTION_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, unknown: await resolveWorldUnknown({ tenantId, unknownId: body.unknownId, claimId: body.claimId }) });
    }

    if (operation === "world_context") {
      return NextResponse.json({ ok: true, world: await getWorldContext({ tenantId, domain: typeof body.domain === "string" ? body.domain : undefined, limit: typeof body.limit === "number" ? body.limit : undefined }) });
    }

    if (operation === "world_snapshot") {
      if (typeof body.domain !== "string") return NextResponse.json({ ok: false, error: "DOMAIN_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, snapshot: await buildWorldSnapshot({ tenantId, domain: body.domain, goals: Array.isArray(body.goals) ? body.goals : undefined, constraints: Array.isArray(body.constraints) ? body.constraints : undefined, priorities: Array.isArray(body.priorities) ? body.priorities : undefined, activeHypotheses: Array.isArray(body.activeHypotheses) ? body.activeHypotheses : undefined }) });
    }

    return NextResponse.json({ ok: false, error: "UNKNOWN_INTELLIGENCE_OPERATION" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "INTELLIGENCE_OPERATION_FAILED" }, { status: 400 });
  }
}