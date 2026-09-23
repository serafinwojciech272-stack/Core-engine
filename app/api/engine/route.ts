import { NextResponse } from "next/server";
import { missions, recordMissionEvent, ENGINE_VERSION, type EngineSignal, type Mission } from "@/lib/engine";
import { buildDecision } from "@/lib/ai-decision";
import { buildAuditChain } from "@/lib/audit-chain";
import { storageMode, listPersistedLearning, persistDecisionMission } from "@/lib/storage";
import { getMT5ReadOnlyStatus } from "@/lib/mt5-gateway";
import { getResilienceStatus } from "@/lib/resilience";
import { getProductionReadiness } from "@/lib/production-readiness";
import { getStageManifest } from "@/lib/stage-manifest";
import { getSecurityControls } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { guardMutation } from "@/lib/http";
import { buildMissionFromDomainPack } from "@/lib/domain-runtime";
import { buildContextEvidence } from "@/lib/context-evidence-runtime";
import type { EvidenceInput } from "@/lib/evidence-engine";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { listCapabilityPacks } from "@/lib/capability-registry";
import { buildGrowthMissionPlan } from "@/lib/growth-mission";

const MAX_BODY_BYTES = 64000;
const MAX_SIGNALS = 30;
const MAX_EVIDENCE = 60;

function signal(x: unknown): x is EngineSignal {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return typeof s.name === "string" && typeof s.value === "string" && typeof s.source === "string"
    && s.name.length > 0 && s.name.length <= 100 && s.value.length > 0 && s.value.length <= 200
    && s.source.length > 0 && s.source.length <= 100;
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "engine");
  if (guard) return guard;
  const rl = rateLimit("engine:" + ((request.headers.get("x-forwarded-for") || "unknown").split(",")[0]));
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try { body = raw ? JSON.parse(raw) : {}; }
    catch { return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 }); }

    const arr = body.signals === undefined
      ? [
          { name: "conversion_rate", value: "2.8%", source: "demo" },
          { name: "traffic", value: "+18%", source: "demo" },
          { name: "checkout_dropoff", value: "41%", source: "demo" }
        ]
      : body.signals;

    if (!Array.isArray(arr) || !arr.length) return NextResponse.json({ ok: false, error: "SIGNALS_REQUIRED" }, { status: 400 });
    if (arr.length > MAX_SIGNALS || !arr.every(signal)) return NextResponse.json({ ok: false, error: "INVALID_SIGNAL_SET" }, { status: 400 });

    const signals = arr.map((s) => ({ name: s.name.trim(), value: s.value.trim(), source: s.source.trim() }));
    const domain = typeof body.domain === "string" ? body.domain.trim().slice(0, 40) : undefined;

    let contextEvidence: ReturnType<typeof buildContextEvidence>;
    try {
      const suppliedEvidence = body.evidence === undefined
        ? signals.map((s) => ({ claim: `${s.name} = ${s.value}`, source: s.source }))
        : body.evidence;
      if (!Array.isArray(suppliedEvidence) || suppliedEvidence.length > MAX_EVIDENCE) {
        return NextResponse.json({ ok: false, error: "INVALID_EVIDENCE_SET" }, { status: 400 });
      }
      contextEvidence = buildContextEvidence({
        signals,
        evidence: suppliedEvidence as EvidenceInput[],
        domain
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "EVIDENCE_RUNTIME_FAILED";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const learning = storageMode() === "supabase" ? await listPersistedLearning(10) : [];
    const decision = await buildDecision(signals, domain, learning);

    if (decision.riskGate === "BLOCK") {
      return NextResponse.json({
        ok: false,
        blocked: true,
        error: "RISK_GATE_BLOCKED",
        decision,
        evidenceQuality: contextEvidence.evidenceQuality,
        trace: [
          { stage: "OBSERVE", status: "COMPLETE", evidence: signals.map((s) => s.name) },
          { stage: "DECIDE", status: "COMPLETE", output: decision.recommendation },
          { stage: "RISK_GATE", status: "BLOCKED", output: "Mission creation denied." }
        ]
      }, { status: 409 });
    }

    const mission: Mission = {
      id: crypto.randomUUID(),
      ...await buildMissionFromDomainPack(decision, domain)
    };

    const persistence = storageMode();
    if (persistence === "supabase") {
      await persistDecisionMission(decision, mission, ENGINE_VERSION);
    } else {
      missions.set(mission.id, mission);
      recordMissionEvent({
        missionId: mission.id,
        decisionId: decision.id,
        eventType: "MISSION_CREATED",
        toState: mission.state,
        actorType: "system"
      });
    }

    const growthMission = buildGrowthMissionPlan({
      missionId: mission.id,
      objective: mission.objective,
      diagnosis: decision.diagnosis,
      recommendation: decision.recommendation,
      signals: signals.map((s) => `${s.name} ${s.value}`)
    });

    const trace = [
      { stage: "OBSERVE", status: "COMPLETE", evidence: signals.map((s) => s.name), output: signals.length + " signals accepted" },
      { stage: "CONTEXT", status: "COMPLETE", evidence: contextEvidence.evidence.map((e) => e.id), output: contextEvidence.context.domain },
      { stage: "EVIDENCE", status: "COMPLETE", evidence: contextEvidence.evidence.map((e) => e.id), output: `${contextEvidence.evidence.length} evidence items; quality ${contextEvidence.evidenceQuality.score}` },
      { stage: "DIAGNOSE", status: "COMPLETE", evidence: decision.evidence.slice(0, 8), output: decision.diagnosis },
      { stage: "PRIORITIZE", status: "COMPLETE", evidence: ["priority=" + decision.priority, "confidence=" + decision.confidence.toFixed(3)], output: decision.priority },
      { stage: "DECIDE", status: "COMPLETE", evidence: [decision.recommendation, ...(decision.signalConflict?.reasons || [])], output: decision.recommendation },
      { stage: "DECISION_MATRIX", status: "COMPLETE", evidence: decision.decisionMatrix?.reasons, output: decision.decisionMatrix?.action || "UNAVAILABLE" },
      { stage: "GROWTH_CAPABILITIES", status: "PLANNED", evidence: growthMission.selectedPacks.map((p) => p.id), output: `${growthMission.selectedPacks.length} capability packs; ${growthMission.actions.length} actions` },
      { stage: "MISSION", status: "CREATED", evidence: ["mission=" + mission.id, "kpi=" + mission.kpi], output: mission.objective },
      { stage: "AWAITING_APPROVAL", status: "PENDING", output: mission.state }
    ];

    const chain = await buildAuditChain({ signals, decision, mission, trace: trace.map((x) => x.stage) });
    const integrity = process.env.AUDIT_SIGNING_KEY ? "SIGNED" : "UNSIGNED";

    return NextResponse.json({
      ok: true,
      engine: "core-engine",
      version: ENGINE_VERSION,
      state: mission.state,
      persistence,
      durable: persistence === "supabase",
      context: contextEvidence.context,
      evidence: contextEvidence.evidence,
      evidenceGraph: contextEvidence.evidenceGraph,
      evidenceQuality: contextEvidence.evidenceQuality,
      decision,
      learning: { applied: learning.length, lessons: learning.slice(0, 4) },
      mission,
      trace,
      audit: {
        algorithm: integrity === "SIGNED" ? "HMAC-SHA256 chained audit v2" : "SHA-256 chained audit v1",
        integrity,
        chainLength: chain.length,
        head: chain.at(-1)?.hash,
        chain
      }
    });
  } catch (error) {
    console.error("[core-engine] engine request failed", error);
    return NextResponse.json({ ok: false, error: "ENGINE_REQUEST_FAILED" }, { status: 503 });
  }
}

export async function GET() {
  ensureCapabilityPacks();
  return NextResponse.json({
    ok: true,
    engine: "core-engine",
    version: ENGINE_VERSION,
    status: "READY",
    capabilities: ["observe", "context", "evidence", "evidence-graph", "diagnose", "prioritize", "decide", "decision-matrix", "risk-gate", "multi-timeframe", "feature-engine", "mission", "approval", "execute", "measure", "learn", "audit", "mt5-read-only"],
    capabilityPacks: listCapabilityPacks().map((pack) => ({ id: pack.id, name: pack.name, category: pack.category, version: pack.version, capabilities: pack.capabilities, actions: pack.actions.map((action) => ({ id: action.id, name: action.name, risk: action.risk, requiresApproval: action.requiresApproval })) })),
    readiness: getProductionReadiness(),
    mt5: getMT5ReadOnlyStatus(),
    resilience: getResilienceStatus(),
    security: getSecurityControls(),
    stageManifest: getStageManifest()
  }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } });
}
