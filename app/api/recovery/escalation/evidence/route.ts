import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { resolveTenant } from "@/lib/commercial-runtime";
import { createPolicyAwareRecoveryDecisionEngine } from "@/lib/m24-28-policy-aware-decision-engine";
import { verifyPolicyEscalation } from "@/lib/recovery-approval-gate";
import { hashRecoveryDecision } from "@/lib/recovery-approval-gate";
import { createSupabaseRecoveryEscalationEvidencePersistence } from "@/lib/m24-32-escalation-evidence-persistence";

function validBody(value: unknown): value is { recoveryKey: string; idempotencyKey: string } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.recoveryKey === "string" && body.recoveryKey.length > 0 && body.recoveryKey.length <= 200
    && typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0 && body.idempotencyKey.length <= 200;
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, "recovery-escalation-evidence");
    if (guard) return guard;
    const tenant = resolveTenant(request);
    const body = await request.json();
    if (!validBody(body)) return NextResponse.json({ ok:false, error:"RECOVERY_ESCALATION_EVIDENCE_INPUT_INVALID" }, {status:400});

    const decision = await createPolicyAwareRecoveryDecisionEngine().decide(tenant.tenantId, body.recoveryKey);
    if (!decision) return NextResponse.json({ok:false,error:"RECOVERY_NOT_FOUND"},{status:404});

    const verification = verifyPolicyEscalation(decision.selectedPolicy ? {
      netWeight: decision.selectedPolicy.netWeight,
      confidenceBps: decision.selectedPolicy.confidenceBps,
      sampleCount: decision.selectedPolicy.sampleCount,
      policyVersion: decision.selectedPolicy.policyVersion,
    } : null, decision);

    const persisted = await createSupabaseRecoveryEscalationEvidencePersistence().commit({
      tenantId: tenant.tenantId,
      recoveryKey: body.recoveryKey,
      idempotencyKey: body.idempotencyKey,
      decisionHash: hashRecoveryDecision(decision),
      verification,
    });

    return NextResponse.json({
      ok:true,
      flow:"POLICY ESCALATION → VERIFICATION → EVIDENCE → PERSISTENCE",
      decision,
      verification,
      persisted,
    }, {status:200});
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_ESCALATION_EVIDENCE_FAILED";
    return NextResponse.json({ok:false,error:message},{status:message.includes("CONFLICT")?409:400});
  }
}

export async function GET(request: Request) {
  try {
    const tenant = resolveTenant(request);
    const recoveryKey = new URL(request.url).searchParams.get("recoveryKey");
    if (!recoveryKey) return NextResponse.json({ok:false,error:"RECOVERY_ESCALATION_EVIDENCE_INPUT_INVALID"},{status:400});
    const records = await createSupabaseRecoveryEscalationEvidencePersistence().read(tenant.tenantId,recoveryKey);
    return NextResponse.json({ok:true,tenantId:tenant.tenantId,recoveryKey,records});
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_ESCALATION_EVIDENCE_READ_FAILED";
    return NextResponse.json({ok:false,error:message},{status:400});
  }
}
