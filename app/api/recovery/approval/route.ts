import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { createPolicyAwareRecoveryDecisionEngine } from "@/lib/m24-28-policy-aware-decision-engine";
import { createSupabaseRecoveryApprovalGate } from "@/lib/recovery-approval-supabase";
import { createSupabaseRecoveryEscalationEvidencePersistence } from "@/lib/m24-32-escalation-evidence-persistence";
import { hashRecoveryDecision, verifyPolicyEscalation } from "@/lib/recovery-approval-gate";
import type { ApprovalAction } from "@/lib/recovery-approval-gate";

function isBody(value: unknown): value is { recoveryKey: string; action: ApprovalAction; idempotencyKey: string; reason?: string | null } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.recoveryKey === "string" && body.recoveryKey.length > 0 && body.recoveryKey.length <= 200
    && (body.action === "APPROVE" || body.action === "REJECT")
    && typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0 && body.idempotencyKey.length <= 200
    && (body.reason === undefined || body.reason === null || typeof body.reason === "string");
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "recovery-approval");
  if (guard) return guard;
  const actor = authenticate(request, true);
  if (actor.kind !== "human") return NextResponse.json({ ok: false, error: "HUMAN_APPROVAL_REQUIRED" }, { status: 403 });

  const runtime = await resolveSaaSContext(request);
  const tenantId = runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
  if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });

  const rl = rateLimit("recovery-approval:" + tenantId);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 }); }
  if (!isBody(body)) return NextResponse.json({ ok: false, error: "RECOVERY_APPROVAL_INPUT_INVALID" }, { status: 400 });

  try {
    const decision = await createPolicyAwareRecoveryDecisionEngine().decide(tenantId, body.recoveryKey);
    if (!decision) return NextResponse.json({ ok: false, error: "RECOVERY_NOT_FOUND" }, { status: 404 });
    if (!decision.requiresApproval) {
      return NextResponse.json({ ok: false, error: "APPROVAL_NOT_REQUIRED", decision, executionPermission: "DENIED" }, { status: 409 });
    }

    const policyWeight = decision.selectedPolicy ? {
      netWeight: decision.selectedPolicy.netWeight,
      confidenceBps: decision.selectedPolicy.confidenceBps,
      sampleCount: decision.selectedPolicy.sampleCount,
      policyVersion: decision.selectedPolicy.policyVersion,
    } : null;

    const verification = verifyPolicyEscalation(policyWeight, decision);
    const persistedEvidence = await createSupabaseRecoveryEscalationEvidencePersistence().commit({
      tenantId,
      recoveryKey: body.recoveryKey,
      idempotencyKey: body.idempotencyKey,
      decisionHash: hashRecoveryDecision(decision),
      verification,
    });

    const approval = await createSupabaseRecoveryApprovalGate().approve({
      tenantId, recoveryKey: body.recoveryKey, decision, action: body.action,
      actorId: actor.id, actorKind: actor.kind, idempotencyKey: body.idempotencyKey,
      reason: body.reason ?? null, policyWeight,
    });

    const executionPermission = approval.executionPermission === "GRANTED" && verification.approvalAllowed ? "GRANTED" : "DENIED";

    return NextResponse.json({
      ok: true,
      flow: "POLICY ESCALATION → VERIFICATION → EVIDENCE → APPROVAL GATE → EXECUTION PERMISSION",
      decision, verification, persistedEvidence, approval, executionPermission,
    }, { status: approval.status === "IDEMPOTENT" ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_APPROVAL_FAILED";
    const status = message.includes("CONFLICT") ? 409 : message.includes("INVALID") ? 400 : 503;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
