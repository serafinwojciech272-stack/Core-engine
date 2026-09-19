import { NextResponse } from "next/server";
import { missions, recordMissionEvent, type EngineSignal, type Decision, type Mission } from "@/lib/engine";
import { persistDecisionMission, storageMode } from "@/lib/storage";
import { buildDecision } from "@/lib/ai-decision";

const MAX_BODY_BYTES = 64_000;
const MAX_SIGNALS = 20;

function missionFor(decision: Decision): Omit<Mission, "id"> {
  const isSales = decision.diagnosis.startsWith("Lead volume");
  const isOps = decision.diagnosis.startsWith("Backlog");
  const now = new Date().toISOString();
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

    const decision = await buildDecision(normalizedSignals);
    const baseMission = missionFor(decision);
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

    return NextResponse.json({
      ok: true,
      engine: "core-engine",
      version: "0.5",
      state: mission.state,
      persistence,
      decision,
      mission,
      trace: ["OBSERVE", "DIAGNOSE", "PRIORITIZE", "DECIDE", "AWAITING_APPROVAL"]
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
    capabilities: ["observe", "diagnose", "prioritize", "decide", "mission", "approval", "execute", "measure", "learn"]
  });
}
