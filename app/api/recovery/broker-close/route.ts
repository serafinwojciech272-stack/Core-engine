import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { resilientBrokerCloseIngest } from "@/lib/resilient-broker-close-ingest";

type Body = {
  brokerKey: string;
  closeCursor: string;
  state: Record<string, unknown>;
  idempotencyKey: string;
  learning?: {
    lessonType: "POSITIVE_DELTA" | "NEGATIVE_DELTA" | "UNVERIFIED";
    quality: "VERIFIED" | "NEGATIVE" | "UNVERIFIED";
    lesson: string;
    reason: string;
    delta?: number | null;
    deltaPct?: number | null;
  } | null;
  metadata?: Record<string, unknown>;
};

function isBody(value: unknown): value is Body {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.brokerKey === "string"
    && body.brokerKey.length > 0
    && body.brokerKey.length <= 200
    && typeof body.closeCursor === "string"
    && body.closeCursor.length > 0
    && body.closeCursor.length <= 200
    && typeof body.idempotencyKey === "string"
    && body.idempotencyKey.length > 0
    && body.idempotencyKey.length <= 200
    && !!body.state
    && typeof body.state === "object"
    && !Array.isArray(body.state);
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "recovery-broker-close");
  if (guard) return guard;

  const runtime = await resolveSaaSContext(request);
  const tenantId = runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });
  }

  const rl = rateLimit("recovery-broker-close:" + tenantId);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isBody(body)) {
    return NextResponse.json({ ok: false, error: "INVALID_BROKER_CLOSE_PAYLOAD" }, { status: 400 });
  }

  try {
    const result = await resilientBrokerCloseIngest({
      tenantId,
      brokerKey: body.brokerKey,
      closeCursor: body.closeCursor,
      state: body.state,
      idempotencyKey: body.idempotencyKey,
      learning: body.learning ?? null,
      metadata: {
        ...(body.metadata ?? {}),
        recoveryFlow: "M24.16_M24.17_M24.19",
      },
    });

    return NextResponse.json({
      ok: true,
      flow: "BROKER_CLOSE -> M24.16 CONTRACT -> M24.17 SUPABASE ADAPTER -> M24.19 ATOMIC COMMIT",
      recovery: result,
    }, { status: result.status === "IDEMPOTENT" ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_COMMIT_FAILED";
    const status = message === "RECOVERY_IDEMPOTENCY_CONFLICT" ? 409 : 503;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
