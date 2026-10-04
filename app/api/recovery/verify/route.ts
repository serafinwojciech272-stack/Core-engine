import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { verifyRecoveryExecution } from "@/lib/m24-25-verification-engine";
import { createSupabaseRecoveryExecutionPersistence } from "@/lib/recovery-execution-persistence";
import { createSupabaseRecoveryVerificationPersistence } from "@/lib/m24-25-verification-persistence";

export async function POST(request: Request) {
  const guard = guardMutation(request, "recovery-verify");
  if (guard) return guard;

  const runtime = await resolveSaaSContext(request);
  const tenantId = runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
  if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });

  const rl = rateLimit("recovery-verify:" + tenantId);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  const body = await request.json().catch(() => null) as {
    recoveryKey?: string;
    executionId?: string;
    observedState?: Record<string, unknown>;
  } | null;

  if (!body?.recoveryKey || !body.executionId || !body.observedState) {
    return NextResponse.json({ ok: false, error: "RECOVERY_VERIFICATION_INPUT_INVALID" }, { status: 400 });
  }

  try {
    const execution = await createSupabaseRecoveryExecutionPersistence()
      .readExecution(tenantId, body.recoveryKey, body.executionId);

    if (!execution) {
      return NextResponse.json({ ok: false, error: "RECOVERY_EXECUTION_NOT_FOUND" }, { status: 404 });
    }

    const result = verifyRecoveryExecution({
      tenantId,
      recoveryKey: body.recoveryKey,
      execution,
      expectedState: execution.checkpoint,
      observedState: body.observedState,
    });

    await createSupabaseRecoveryVerificationPersistence().commit(result, body.observedState);

    return NextResponse.json({
      ok: true,
      flow: "EXECUTION EVENT → VERIFICATION → OUTCOME → LEARNING",
      result,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_VERIFICATION_FAILED";
    const status = message.includes("SCOPE") ? 403 : message.includes("NOT_FOUND") ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
