import { NextResponse } from "next/server";
import {
  createUniversalAgentRun,
  approveUniversalAgentRun,
  advanceUniversalAgentRun,
  recoverUniversalAgentRun,
  replanUniversalAgentRun,
  selectUniversalAgentProvider,
  verifyUniversalAgentRun,
  type UniversalAgentRun
} from "@/lib/universal-agent-os";
import { guardMutation } from "@/lib/http";

const MAX = 32000;

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "universal-agent-operating-system",
    version: "uaos-v1",
    stages: [125,126,127,128,129,130,131,132,133,134,135],
    executionPolicy: "HUMAN_APPROVAL_REQUIRED"
  });
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "universal-agent-os");
  if (guard) return guard;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    }
    const body = raw ? JSON.parse(raw) : {};
    const action = String(body.action || "verify");
    const run = body.run as UniversalAgentRun | undefined;

    if (action === "create") {
      if (!body.plan) return NextResponse.json({ ok: false, error: "PLAN_REQUIRED" }, { status: 400 });
      const created = createUniversalAgentRun(body.plan);
      return NextResponse.json({ ok: true, action, run: created, verification: verifyUniversalAgentRun(created) });
    }
    if (!run) return NextResponse.json({ ok: false, error: "RUN_REQUIRED" }, { status: 400 });

    if (action === "approve") {
      const next = approveUniversalAgentRun(run);
      return NextResponse.json({ ok: true, action, run: next, verification: verifyUniversalAgentRun(next) });
    }
    if (action === "advance") {
      const next = advanceUniversalAgentRun(run, Array.isArray(body.evidence) ? body.evidence.map(String) : [], body.outcome);
      return NextResponse.json({ ok: true, action, run: next, verification: verifyUniversalAgentRun(next) });
    }
    if (action === "recover") {
      const next = recoverUniversalAgentRun(run, String(body.reason || ""));
      return NextResponse.json({ ok: true, action, run: next, verification: verifyUniversalAgentRun(next) });
    }
    if (action === "replan") {
      const next = replanUniversalAgentRun(run, Array.isArray(body.feedback) ? body.feedback.map(String) : []);
      return NextResponse.json({ ok: true, action, run: next, verification: verifyUniversalAgentRun(next) });
    }
    if (action === "provider") {
      const providers = Array.isArray(body.providers) ? body.providers : [];
      return NextResponse.json({ ok: true, action, routing: selectUniversalAgentProvider(providers, String(body.capability || "general")) });
    }
    if (action === "verify") {
      return NextResponse.json({ ok: true, action, run, verification: verifyUniversalAgentRun(run) });
    }
    return NextResponse.json({ ok: false, error: "UNKNOWN_UNIVERSAL_AGENT_OS_ACTION" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNIVERSAL_AGENT_OS_OPERATION_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
