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

type GatewayBody = {
  task?: unknown;
  context?: unknown;
  mode?: unknown;
  model?: unknown;
};

export async function POST(request: Request) {
  const guard = guardMutation(request, "agent");
  if (guard) return guard;

  const client = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const rl = rateLimit("ai-gateway:" + client);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const started = Date.now();
  const requestId = "ce-gw-" + randomUUID();

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE", requestId }, { status: 413 });
    }

    let body: GatewayBody;
    try { body = raw ? JSON.parse(raw) : {}; }
    catch { return NextResponse.json({ ok: false, error: "INVALID_JSON", requestId }, { status: 400 }); }

    const task = typeof body.task === "string" ? body.task.trim() : "";
    const context = typeof body.context === "string" ? body.context.slice(0, MAX_CONTEXT) : "";
    const requestedMode = typeof body.mode === "string" ? body.mode : "auto";

    if (!task) {
      return NextResponse.json({ ok: false, error: "TASK_REQUIRED", requestId }, { status: 400 });
    }
    if (task.length > MAX_TASK) {
      return NextResponse.json({ ok: false, error: "TASK_TOO_LARGE", requestId }, { status: 413 });
    }

    const verification = { enabled: true, policy: "result-verification-v1" };
    let result = await multiModelGenerate(task, context);
    let provider = "openrouter-multi";
    let model = result.selectedModel;
    let text = result.text;
    let attempts = result.candidates.map((candidate) => ({
      provider: "openrouter",
      model: candidate.model,
      ok: true,
      latencyMs: candidate.latencyMs,
      verification: candidate.verification
    }));

    if (!result.ok || !text) {
      const fallback = await universalGenerate(task, context);
      if (!fallback.ok || !fallback.text) {
        return NextResponse.json({
          ok: false,
          error: "AI_PROVIDER_UNAVAILABLE",
          requestId,
          latencyMs: Date.now() - started,
          routing: {
            requestedMode,
            selectedProvider: null,
            selectedModel: null,
            fallbackUsed: true,
            attempts: [...attempts, ...(fallback.attempts || [])]
          },
          errors: result.errors
        }, { status: 503 });
      }
      provider = fallback.provider || "unknown";
      model = fallback.model;
      text = fallback.text;
      attempts = [...attempts, ...(fallback.attempts || [])];
    }

    const resultVerification = verifyResult(task, text);
    const latencyMs = Date.now() - started;

    return NextResponse.json({
      ok: true,
      gateway: "core-engine-ai",
      version: "1.0",
      requestId,
      output: { text, type: "text" },
      routing: {
        requestedMode,
        selectedProvider: provider,
        selectedModel: model || null,
        fallbackUsed: provider !== "openrouter-multi" && !provider.startsWith("openrouter"),
        attempts
      },
      performance: { latencyMs, llm: true },
      verification: resultVerification,
      control: {
        externalSideEffects: "BLOCKED",
        approvalRequired: true,
        executionPolicy: "CORE_ENGINE_CONTROL_PLANE"
      },
      contract: {
        request: "task + optional context",
        response: "output + routing + performance + verification",
        stableRequestId: true
      }
    });
  } catch (error) {
    console.error("[core-engine] ai gateway failed", error);
    return NextResponse.json({
      ok: false,
      error: "AI_GATEWAY_FAILED",
      requestId,
      latencyMs: Date.now() - started
    }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    gateway: "core-engine-ai",
    version: "1.0",
    status: "READY",
    contract: {
      method: "POST",
      fields: ["task", "context", "mode"],
      output: ["text", "requestId", "routing", "performance", "verification"]
    },
    policy: {
      provider: "OpenRouter-first",
      externalSideEffects: "BLOCKED",
      approvalRequired: true
    }
  }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } });
}
