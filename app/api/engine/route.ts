import { NextResponse } from "next/server";
import { missions, recordMissionEvent, type EngineSignal, type Decision, type Mission } from "@/lib/engine";
import { persistDecisionMission, storageMode } from "@/lib/storage";
import { buildDecision } from "@/lib/ai-decision";

function missionFor(decision: Decision): Omit<Mission, "id"> {
  const isSales = decision.diagnosis.startsWith("Lead volume");
  const isOps = decision.diagnosis.startsWith("Backlog");
  return {
    decisionId: decision.id,
    objective: isSales
      ? "Increase qualified lead conversion while reducing response latency."
      : isOps
        ? "Reduce operational cycle time without compromising service quality."
        : "Increase qualified checkout completion without increasing acquisition spend.",
    state: "AWAITING_APPROVAL",
    kpi: isSales ? "lead_to_opportunity_rate" : isOps ? "cycle_time" : "checkout_completion_rate",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 0
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const signals: EngineSignal[] = Array.isArray(body.signals)
      ? body.signals.filter((s: unknown): s is EngineSignal => {
          if (!s || typeof s !== "object") return false;
          const x = s as Record<string, unknown>;
          return typeof x.name === "string" && typeof x.value === "string" && typeof x.source === "string";
        }).slice(0, 20)
      : [];

    const normalizedSignals = signals.length ? signals : [
      { name: "conversion_rate", value: "2.8%", source: "demo" },
      { name: "traffic", value: "+18%", source: "demo" },
      { name: "checkout_dropoff", value: "41%", source: "demo" }
    ];

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
      version: "0.4",
      state: mission.state,
      persistence,
      decision,
      mission,
      trace: ["OBSERVE", "DIAGNOSE", "PRIORITIZE", "DECIDE", "AWAITING_APPROVAL"]
    });
  } catch {
    return NextResponse.json({ ok: false, error: "ENGINE_REQUEST_FAILED" }, { status: 400 });
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
