import { NextResponse } from "next/server";
import { buildUniversalAgentPlan, replanUniversalAgent, canUniversalAgentExecute, advanceUniversalAgentStage, approveUniversalAgentPlan } from "@/lib/universal-agent";
import { createUniversalAgentRun, approveUniversalAgentRun, advanceUniversalAgentRun, replanUniversalAgentRun, universalAgentOsSummary } from "@/lib/universal-agent-os";
import { guardMutation } from "@/lib/http";

const MAX = 32000;

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "universal-agent",
    version: "universal-agent-v2",
    operatingSystem: "universal-agent-os-v1",
    stages: 113,
    executionPolicy: "HUMAN_APPROVAL_REQUIRED"
  });
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "universal-agent");
  if (guard) return guard;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    }
    const body = raw ? JSON.parse(raw) : {};
    const action = String(body.action || "plan");

    if (action === "plan") {
      const plan = buildUniversalAgentPlan({
        objective: String(body.objective || ""),
        domain: body.domain,
        constraints: body.constraints,
        signals: body.signals,
        diagnosis: body.diagnosis,
        recommendation: body.recommendation,
        approval: body.approval === "APPROVED" ? "APPROVED" : "PENDING"
      });
      return NextResponse.json({ ok: true, action, plan, execution: canUniversalAgentExecute(plan) });
    }

    if (action === "start") {
      const plan = body.plan;
      if (!plan || typeof plan !== "object") return NextResponse.json({ ok: false, error: "PLAN_REQUIRED" }, { status: 400 });
      const run = createUniversalAgentRun(plan);
      return NextResponse.json({ ok: true, action, run, summary: universalAgentOsSummary(run) });
    }

    if (action === "approve") {
      const plan = body.plan;
      if (!plan || typeof plan !== "object") return NextResponse.json({ ok: false, error: "PLAN_REQUIRED" }, { status: 400 });
      const next = approveUniversalAgentPlan(plan);
      return NextResponse.json({ ok: true, action, plan: next, execution: canUniversalAgentExecute(next) });
    }

    if (action === "os-approve") {
      const run = body.run;
      if (!run || typeof run !== "object") return NextResponse.json({ ok: false, error: "RUN_REQUIRED" }, { status: 400 });
      const next = approveUniversalAgentRun(run);
      return NextResponse.json({ ok: true, action, run: next, summary: universalAgentOsSummary(next) });
    }

    if (action === "advance") {
      const plan = body.plan;
      if (!plan || typeof plan !== "object") return NextResponse.json({ ok: false, error: "PLAN_REQUIRED" }, { status: 400 });
      const next = advanceUniversalAgentStage(plan, Number(body.stageId), Array.isArray(body.evidence) ? body.evidence.map(String) : []);
      return NextResponse.json({ ok: true, action, plan: next, execution: canUniversalAgentExecute(next) });
    }

    if (action === "os-advance") {
      const run = body.run;
      if (!run || typeof run !== "object") return NextResponse.json({ ok: false, error: "RUN_REQUIRED" }, { status: 400 });
      const next = advanceUniversalAgentRun(run, String(body.to), Array.isArray(body.evidence) ? body.evidence.map(String) : []);
      return NextResponse.json({ ok: true, action, run: next, summary: universalAgentOsSummary(next) });
    }

    if (action === "replan") {
      const plan = body.plan;
      if (!plan || typeof plan !== "object") return NextResponse.json({ ok: false, error: "PLAN_REQUIRED" }, { status: 400 });
      const next = replanUniversalAgent(plan, Array.isArray(body.feedback) ? body.feedback.map(String) : []);
      return NextResponse.json({ ok: true, action, plan: next, execution: canUniversalAgentExecute(next) });
    }

    if (action === "os-replan") {
      const run = body.run;
      if (!run || typeof run !== "object") return NextResponse.json({ ok: false, error: "RUN_REQUIRED" }, { status: 400 });
      const next = replanUniversalAgentRun(run, String(body.reason || ""));
      return NextResponse.json({ ok: true, action, run: next, summary: universalAgentOsSummary(next) });
    }

    return NextResponse.json({ ok: false, error: "UNKNOWN_UNIVERSAL_AGENT_ACTION" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNIVERSAL_AGENT_OPERATION_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
