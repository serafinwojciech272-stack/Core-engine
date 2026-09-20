import { NextResponse } from "next/server";
import { missions, recordMissionEvent, type EngineSignal, type Decision, type Mission } from "@/lib/engine";
import { listPersistedLearning, persistDecisionMission, storageMode } from "@/lib/storage";
import { buildDecision } from "@/lib/ai-decision";
import { buildAuditChain } from "@/lib/audit-chain";
import { getMT5ReadOnlyStatus } from "@/lib/mt5-gateway";
import { getResilienceStatus } from "@/lib/resilience";
import { getProductionReadiness } from "@/lib/production-readiness";
import { getStageManifest } from "@/lib/stage-manifest";
import { getSecurityControls } from "@/lib/security";

const MAX_BODY_BYTES = 64_000;
const MAX_SIGNALS = 30;

function missionFor(decision: Decision, domain?: string): Omit<Mission, "id"> {
  const isSales = decision.diagnosis.startsWith("Lead volume");
  const isOps = decision.diagnosis.startsWith("Backlog");
  const now = new Date().toISOString();
  if (domain === "trading") {
    return {
      decisionId: decision.id,
      objective: decision.recommendation,
      state: "AWAITING_APPROVAL",
      kpi: "net_expected_r",
      createdAt: now,
      updatedAt: now,
      executionCount: 0
    };
  }
  return {
    decisionId: decision.id,
    objective: isSales
      ? "Increase qualified lead conversion while reducing response latency."
      : isOps
        ? "Reduce operational cycle time without compromising service quality."
        : "Increase qualified checkout completion without increasing acquisition spend.",
    state: "AWAITING_APPROVAL",
    kpi: isSales ? "lead_to_opportunity_rate" : isOps ? "cycle_time" : "checkout_completion_rate",
    createdAt: now,
    updatedAt: now,
    executionCount: 0
  };
}

function isSignal(value: unknown): value is EngineSignal {
  if (!value || typeof value !== "object") return false;
  const x = value as Record<string, unknown>;
  return (
    typeof x.name === "string" &&
    typeof x.value === "string" &&
    typeof x.source === "string" &&
    x.name.trim().length > 0 &&
    x.value.trim().length > 0 &&
    x.source.trim().length > 0 &&
    x.name.length <= 100 &&
    x.value.length <= 200 &&
    x.source.length <= 100
  );
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    }

    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    let normalizedSignals: EngineSignal[];

    if (payload.signals === undefined) {
      normalizedSignals = [
        { name: "conversion_rate", value: "2.8%", source: "demo" },
        { name: "traffic", value: "+18%", source: "demo" },
        { name: "checkout_dropoff", value: "41%", source: "demo" }
      ];
    } else if (!Array.isArray(payload.signals)) {
      return NextResponse.json({ ok: false, error: "SIGNALS_MUST_BE_ARRAY" }, { status: 400 });
    } else if (payload.signals.length === 0) {
      return NextResponse.json({ ok: false, error: "SIGNALS_REQUIRED" }, { status: 400 });
    } else if (payload.signals.length > MAX_SIGNALS) {
      return NextResponse.json({ ok: false, error: "TOO_MANY_SIGNALS", max: MAX_SIGNALS }, { status: 400 });
    } else if (!payload.signals.every(isSignal)) {
      return NextResponse.json({ ok: false, error: "INVALID_SIGNAL" }, { status: 400 });
    } else {
      normalizedSignals = payload.signals.map((signal) => ({
        name: signal.name.trim(),
        value: signal.value.trim(),
        source: signal.source.trim()
      }));
    }

    const domain = typeof payload.domain === "string" ? payload.domain.trim().slice(0, 40) : undefined;
    const learning = storageMode() === "supabase" ? await listPersistedLearning(10) : [];
    const decision = await buildDecision(normalizedSignals, domain, learning);

    // Hard safety gate: a BLOCK decision must never create an executable mission.
    // The caller receives the decision context so the UI/API can surface the reason.
    if (decision.riskGate === "BLOCK") {
      return NextResponse.json({
        ok: false,
        blocked: true,
        error: "RISK_GATE_BLOCKED",
        engine: "core-engine",
        decision,
        trace: [
          { stage: "OBSERVE", status: "COMPLETE", evidence: normalizedSignals.map((signal) => signal.name) },
          { stage: "DIAGNOSE", status: "COMPLETE", output: decision.diagnosis },
          { stage: "PRIORITIZE", status: "COMPLETE", output: decision.priority },
          { stage: "DECIDE", status: "COMPLETE", output: decision.recommendation },
          { stage: "RISK_GATE", status: "BLOCKED", output: "Execution mission creation denied by risk gate." }
        ]
      }, { status: 409 });
    }

    const baseMission = missionFor(decision, domain);
    const mission: Mission = { id: crypto.randomUUID(), ...baseMission };
    const persistence = storageMode();

    if (persistence === "supabase") {
      await persistDecisionMission(decision, mission);
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

    const riskGate = String(decision.riskGate ?? "UNAVAILABLE");
    const riskGateStatus = riskGate === "BLOCK" ? "BLOCKED" : riskGate === "CAUTION" ? "CAUTION" : riskGate === "PASS" ? "PASS" : "UNAVAILABLE";

    const trace = [
      { stage: "OBSERVE", status: "COMPLETE", evidence: normalizedSignals.map((signal) => signal.name), output: `${normalizedSignals.length} signals accepted` },
      { stage: "DIAGNOSE", status: "COMPLETE", evidence: decision.evidence.slice(0, 8), output: decision.diagnosis },
      { stage: "PRIORITIZE", status: "COMPLETE", evidence: [`priority=${decision.priority}`, `confidence=${decision.confidence.toFixed(3)}`], output: decision.priority },
      { stage: "DECIDE", status: "COMPLETE", evidence: [`recommendation=${decision.recommendation}`, ...(decision.signalConflict?.reasons ?? [])], output: decision.recommendation },
      { stage: "RISK_GATE", status: riskGateStatus, evidence: [`riskGate=${riskGate}`, ...(decision.signalConflict?.conflicting ?? [])], output: riskGate },
      { stage: "MISSION", status: "CREATED", evidence: [`mission=${mission.id}`, `kpi=${mission.kpi}`], output: mission.objective },
      { stage: "AWAITING_APPROVAL", status: "PENDING", evidence: ["human approval required before execution"], output: mission.state }
    ];
    const auditTrace = trace.map((step) => step.stage);
    const auditChain = await buildAuditChain({ signals: normalizedSignals, decision, mission, trace: auditTrace });

    return NextResponse.json({
      ok: true,
      engine: "core-engine",
      version: "1.0",
      state: mission.state,
      persistence,
      decision,
      learning: { applied: learning.length, lessons: learning.slice(0, 4) },
      mission,
      trace,
      audit: {
        algorithm: "SHA-256 chained audit v1",
        integrity: "VERIFIABLE",
        chainLength: auditChain.length,
        head: auditChain[auditChain.length - 1]?.hash,
        chain: auditChain
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "ENGINE_REQUEST_FAILED" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    engine: "core-engine",
    status: "READY",
    capabilities: ["observe", "diagnose", "prioritize", "decide", "risk-gate", "multi-timeframe", "feature-engine", "mission", "approval", "execute", "measure", "learn", "audit", "mt5-read-only"],
    readiness: getProductionReadiness(),
    mt5: getMT5ReadOnlyStatus(),
    resilience: getResilienceStatus(),
    security: getSecurityControls(),
    stageManifest: getStageManifest()
  });
}
