import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { reconstructRecoveryState } from "@/lib/recovery-state-reconstruction";

export async function GET(request: Request) {
  const guard = guardMutation(request, "recovery-state");
  if (guard) return guard;

  const runtime = await resolveSaaSContext(request);
  const tenantId = runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });
  }

  const rl = rateLimit("recovery-state:" + tenantId);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const recoveryKey = new URL(request.url).searchParams.get("recoveryKey")?.trim();
  if (!recoveryKey) {
    return NextResponse.json({ ok: false, error: "RECOVERY_RECONSTRUCTION_QUERY_INVALID" }, { status: 400 });
  }

  try {
    const state = await reconstructRecoveryState(tenantId, recoveryKey);

    return NextResponse.json({
      ok: true,
      found: Boolean(state),
      flow: "RECOVERY READ → STATE RECONSTRUCTION",
      state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_RECONSTRUCTION_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
