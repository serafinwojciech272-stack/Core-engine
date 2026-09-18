import { NextResponse } from "next/server";

type Signal = { name: string; value: string; source: string };
type Decision = { id: string; diagnosis: string; recommendation: string; confidence: number; priority: "HIGH"|"MEDIUM"|"LOW"; evidence: string[] };
type Mission = { id: string; decisionId: string; objective: string; status: "AWAITING_APPROVAL"; kpi: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const signals: Signal[] = Array.isArray(body.signals) ? body.signals : [
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

  const mission: Mission = {
    id: crypto.randomUUID(),
    decisionId: decision.id,
    objective: "Increase qualified checkout completion without increasing acquisition spend.",
    status: "AWAITING_APPROVAL",
    kpi: "checkout_completion_rate"
  };

  return NextResponse.json({
    ok: true,
    engine: "core-engine",
    version: "0.1",
    state: "AWAITING_APPROVAL",
    decision,
    mission,
    trace: ["OBSERVE", "DIAGNOSE", "PRIORITIZE", "DECIDE", "AWAITING_APPROVAL"]
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    engine: "core-engine",
    status: "READY",
    capabilities: ["observe", "diagnose", "prioritize", "decide", "mission", "approval", "measure", "learn"]
  });
}