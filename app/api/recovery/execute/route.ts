import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { createSupabaseExecutionPermissionReader } from "@/lib/recovery-execution-permission";
import { createSupabaseRecoveryExecutor } from "@/lib/recovery-supabase-executor";

export async function POST(request: Request) {
  const guard = guardMutation(request, "recovery-execute");
  if (guard) return guard;
  const runtime = await resolveSaaSContext(request);
  const tenantId = runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
  if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });
  const rl = rateLimit("recovery-execute:" + tenantId);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json().catch(() => null) as { recoveryKey?: string; idempotencyKey?: string; checkpoint?: Record<string, unknown> } | null;
  if (!body?.recoveryKey || !body.idempotencyKey || !body.checkpoint) return NextResponse.json({ ok: false, error: "RECOVERY_EXECUTION_INPUT_INVALID" }, { status: 400 });
  try {
    const permission = await createSupabaseExecutionPermissionReader().read(tenantId, body.recoveryKey);
    if (!permission) return NextResponse.json({ ok: false, error: "EXECUTION_PERMISSION_NOT_FOUND" }, { status: 403 });
    const event = await createSupabaseRecoveryExecutor().execute({ tenantId, recoveryKey: body.recoveryKey, permission, checkpoint: body.checkpoint, idempotencyKey: body.idempotencyKey });
    return NextResponse.json({ ok: true, flow: "EXECUTION PERMISSION → RECOVERY EXECUTOR → EXECUTION EVENT → POST-EXECUTION STATE", event }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_EXECUTION_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("PERMISSION") ? 403 : 503 });
  }
}
