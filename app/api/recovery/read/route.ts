import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { readRecovery } from "@/lib/recovery-read";

export async function GET(request: Request) {
  const guard = guardMutation(request, "recovery-read");
  if (guard) return guard;

  const runtime = await resolveSaaSContext(request);
  const tenantId = runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });
  }

  const rl = rateLimit("recovery-read:" + tenantId);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const url = new URL(request.url);
  const recoveryKey = url.searchParams.get("recoveryKey")?.trim();
  const idempotencyKey = url.searchParams.get("idempotencyKey")?.trim() || null;

  if (!recoveryKey) {
    return NextResponse.json({ ok: false, error: "RECOVERY_READ_QUERY_INVALID" }, { status: 400 });
  }

  try {
    const recovery = await readRecovery({
      tenantId,
      recoveryKey,
      idempotencyKey,
    });

    if (!recovery) {
      return NextResponse.json({
        ok: true,
        found: false,
        recovery: null,
      }, { status: 200 });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      flow: "RECOVERY READ → CHECKPOINT + LEARNING",
      recovery,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_READ_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
