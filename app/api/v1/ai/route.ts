import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { multiModelGenerate } from "@/lib/multi-model-execution";
import { universalGenerate } from "@/lib/universal-ai-router";
import { verifyResult } from "@/lib/result-verification";

const MAX_BODY_BYTES = 64000;
const MAX_TASK = 12000;
const MAX_CONTEXT = 50000;

type GatewayBody = { task?: unknown; context?: unknown; mode?: unknown; model?: unknown; };
type GatewayAttempt = { provider: string; model: string; ok: boolean; latencyMs: number; verification: ReturnType<typeof verifyResult> | undefined; };

export async function POST(request: Request) {
  const guard = guardMutation(request, "agent");
  if (guard) return guard;
  const client = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const rl = rateLimit("ai-gateway:" + client);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  const started = Date.now();
  const requestId = "ce-gw-" + randomUUID();

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE", requestId }, { status: 413 });
    let body: GatewayBody;
    try { body = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ ok: false, error: "INVALID_JSON", requestId }, { status: 400 }); }

    const task = typeof body.task === "string" ? body.task.trim() : "";
    const context = typeof body.context === "string" ? body.context.slice(0, MAX_CONTEXT) : "";
    const requestedMode = typeof body.mode === "string" ? body.mode : "auto";
    if (!task) return NextResponse.json({ ok: false, error: "TASK_REQUIRED", requestId }, { status: 400 });
    if (task.length > MAX_TASK) return NextResponse.json({ ok: false, error: "TASK_TOO_LARGE", requestId }, { status: 413 });

    const multiModelStarted = Date.now();
    const result = await multiModelGenerate(task, context);
    const multiModelMs = Date.now() - multiModelStarted;

    let provider = "openrouter-multi";
    let model = result.selectedModel;
    let text = result.text;
    let attempts: GatewayAttempt[] = result.candidates.map((candidate) => ({
      provider: "openrouter", model: candidate.model, ok: true, latencyMs: candidate.latencyMs, verification: candidate.verification
    }));

    let fallbackMs = 0;
    if (!result.ok || !text) {
      const fallbackStarted = Date.now();
      const fallback = await universalGenerate(task, context);
      fallbackMs = Date.now() - fallbackStarted;

      if (!fallback.ok || !fallback.text) {
        const totalMs = Date.now() - started;
        console.warn("[core-engine] ai gateway provider unavailable", JSON.stringify({ requestId, requestedMode, multiModelMs, fallbackMs, totalMs, attempts: fallback.attempts }));
        return NextResponse.json({
          ok: false, error: "AI_PROVIDER_UNAVAILABLE", requestId, latencyMs: totalMs,
          routing: {
            requestedMode, selectedProvider: null, selectedModel: null, fallbackUsed: true,
            attempts: [...attempts, ...(fallback.attempts || []).map((attempt) => ({
              provider: attempt.provider, model: attempt.model, ok: attempt.ok, latencyMs: attempt.latencyMs, verification: undefined
            }))]
          },
          performance: { latencyMs: totalMs, llm: true, breakdownMs: { multiModel: multiModelMs, fallback: fallbackMs, verification: 0 } },
          errors: result.errors
        }, { status: 503 });
      }

      provider = fallback.provider || "unknown";
      model = fallback.model;
      text = fallback.text;
      attempts = [...attempts, ...(fallback.attempts || []).map((attempt) => ({
        provider: attempt.provider, model: attempt.model, ok: attempt.ok, latencyMs: attempt.latencyMs, verification: undefined
      }))];
    }

    const verificationStarted = Date.now();
    const resultVerification = verifyResult(task, text);
    const verificationMs = Date.now() - verificationStarted;
    const latencyMs = Date.now() - started;

    console.info("[core-engine] ai gateway timing", JSON.stringify({
      requestId, requestedMode, provider, model: model || null, latencyMs, multiModelMs, fallbackMs, verificationMs,
      providerAttempts: attempts.map((attempt) => ({ provider: attempt.provider, model: attempt.model, ok: attempt.ok, latencyMs: attempt.latencyMs }))
    }));

    return NextResponse.json({
      ok: true, gateway: "core-engine-ai", version: "1.0", requestId,
      output: { text, type: "text" },
      routing: {
        requestedMode, selectedProvider: provider, selectedModel: model || null,
        fallbackUsed: provider !== "openrouter-multi" && !provider.startsWith("openrouter"), attempts
      },
      performance: {
        latencyMs, llm: true,
        breakdownMs: { multiModel: multiModelMs, fallback: fallbackMs, verification: verificationMs }
      },
      verification: resultVerification,
      control: { externalSideEffects: "BLOCKED", approvalRequired: true, executionPolicy: "CORE_ENGINE_CONTROL_PLANE" },
      contract: { request: "task + optional context", response: "output + routing + performance + verification", stableRequestId: true }
    });
  } catch (error) {
    console.error("[core-engine] ai gateway failed", error);
    return NextResponse.json({ ok: false, error: "AI_GATEWAY_FAILED", requestId, latencyMs: Date.now() - started }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true, gateway: "core-engine-ai", version: "1.0", status: "READY",
    contract: { method: "POST", fields: ["task", "context", "mode"], output: ["text", "requestId", "routing", "performance", "verification"] },
    policy: { provider: "OpenRouter-first", externalSideEffects: "BLOCKED", approvalRequired: true }
  }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } });
}
