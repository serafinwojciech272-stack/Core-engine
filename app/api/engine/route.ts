import { NextResponse } from "next/server";
import { missions, recordMissionEvent, type EngineSignal, type Decision, type Mission } from "@/lib/engine";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const signals: EngineSignal[] = Array.isArray(body.signals) ? body.signals : [
    { name: "conversion_rate", value: "2.8%", source: "demo" },
    { name: "traffic", value: "+18%", source: "demo" },
    { name: "checkout_dropoff", value: "41%", source: "demo" }
  ];

  const decision: Decision = {
    id: crypto.randomUUID(),
    diagnosis: "Traffic is growing while checkout friction is limiting conversion.",
    recommendation: "Prioritize checkout optimization and run a measured conversion experiment.",
    confidence: 0.91,
    priority: "HIGH",
    evidence: signals.map(s => `${s.name}: ${s.value} [${s.source}]`)
  };

  const now = new Date().toISOString();
  const mission: Mission = {
    id: crypto.randomUUID(),
    decisionId: decision.id,
    objective: "Increase qualified checkout completion without increasing acquisition spend.",
    state: "AWAITING_APPROVAL",
    kpi: "checkout_completion_rate",
    createdAt: now,
    updatedAt: now,
    executionCount: 0
  };
  missions.set(mission.id, mission);
  recordMissionEvent({ missionId: mission.id, decisionId: decision.id, eventType: "MISSION_CREATED", toState: mission.state, actorType: "system" });

  return NextResponse.json({
    ok: true, engine: "core-engine", version: "0.2",
    state: mission.state, decision, mission,
    trace: ["OBSERVE","DIAGNOSE","PRIORITIZE","DECIDE","AWAITING_APPROVAL"]
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true, engine: "core-engine", status: "READY",
    capabilities: ["observe","diagnose","prioritize","decide","mission","approval","execute","measure","learn"]
  });
}
