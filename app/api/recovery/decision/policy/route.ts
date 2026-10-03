import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSTenant } from "@/lib/saas-tenant";
import { createPolicyAwareRecoveryDecisionEngine } from "@/lib/m24-28-policy-aware-decision-engine";

export async function POST(request: Request) {
  const guard = guardMutation(request, "recovery-decision-policy");
  if (guard) return guard;
  const tenant = await resolveSaaSTenant(request);
  const tenantId = tenant.id;
  const rl = rateLimit("recovery-decision-policy:" + tenantId);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json().catch(() => null) as { recoveryKey?: string } | null;
  if (!body?.recoveryKey) return NextResponse.json({ ok: false, error: "RECOVERY_DECISION_POLICY_INPUT_INVALID" }, { status: 400 });
  try {
    const result = await createPolicyAwareRecoveryDecisionEngine().decide(tenantId, body.recoveryKey);
    if (!result) return NextResponse.json({ ok: false, error: "RECOVERY_STATE_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      flow: "RECOVERY STATE + LEARNING POLICY → POLICY-AWARE DECISION ENGINE → RESUME / REPLAY / RECONCILE",
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_POLICY_DECISION_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("SCOPE") ? 403 : 400 });
  }
}
