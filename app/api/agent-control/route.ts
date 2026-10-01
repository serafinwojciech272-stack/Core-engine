import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { runAgentControl } from "@/lib/agent-control-plane";
import type { EngineSignal } from "@/lib/engine";

function validSignal(value: unknown): value is EngineSignal {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return typeof s.name === "string" && typeof s.value === "string" && typeof s.source === "string";
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "agent-control");
  if (guard) return guard;
  const rl = rateLimit("agent-control:" + ((request.headers.get("x-forwarded-for") || "unknown").split(",")[0]));
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  await resolveSaaSContext(request);
  try {
    const body = await request.json() as Record<string, unknown>;
    const signals = Array.isArray(body.signals) ? body.signals : [];
    if (!signals.length || signals.length > 30 || !signals.every(validSignal)) {
      return NextResponse.json({ ok: false, error: "INVALID_SIGNAL_SET" }, { status: 400 });
    }
    const result = await runAgentControl({
      signals: signals.map((s) => ({ name: s.name.trim(), value: s.value.trim(), source: s.source.trim() })),
      domain: typeof body.domain === "string" ? body.domain : undefined,
      requestedCapability: typeof body.requestedCapability === "string" ? body.requestedCapability : undefined,
      actor: { id: request.headers.get("x-agent-actor") || "human", kind: "human" }
    });
    return NextResponse.json(result, { status: result.policy.status === "BLOCK" ? 409 : 200 });
  } catch (error) {
    console.error("[core-agent] control plane failed", error);
    return NextResponse.json({ ok: false, error: "AGENT_CONTROL_FAILED" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent: "core-agent",
    version: "M12-M15",
    stages: ["INTENT", "CAPABILITY_MATCH", "POLICY_GATE", "RISK_ASSESSMENT", "APPROVAL_OBJECT", "EXECUTION_PLAN", "VERIFICATION_PLAN", "MEMORY_EVENT", "LEARNING_EVENT", "AUDIT_COMMIT"],
    invariant: "No execution side effect before policy and approval gates"
  }, { headers: { "Cache-Control": "public, max-age=30" } });
}
