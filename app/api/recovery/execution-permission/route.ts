import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { createSupabaseExecutionPermissionReader } from "@/lib/recovery-execution-permission";

export async function GET(request: Request) {
  try {
    authenticate(request, true);
  } catch {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const runtime = await resolveSaaSContext(request);
  const tenantId = runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
  if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });

  const rl = rateLimit("recovery-execution-permission:" + tenantId);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  const params = new URL(request.url).searchParams;
  const recoveryKey = params.get("recoveryKey")?.trim();
  const approvalId = params.get("approvalId")?.trim() || null;
  if (!recoveryKey) return NextResponse.json({ ok: false, error: "RECOVERY_EXECUTION_PERMISSION_QUERY_INVALID" }, { status: 400 });

  try {
    const permission = await createSupabaseExecutionPermissionReader().read(tenantId, recoveryKey, approvalId);
    return NextResponse.json({
      ok: true,
      found: Boolean(permission),
      executionPermission: permission?.executionPermission ?? "DENIED",
      permission,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_EXECUTION_PERMISSION_READ_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
