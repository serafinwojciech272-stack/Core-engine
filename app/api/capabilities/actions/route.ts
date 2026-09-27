import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext, consumeSaaSUsage } from "@/lib/saas-runtime";
import { getCapabilityAction, executeCapabilityAction, listCapabilityActions, classifyCapabilityReceipt } from "@/lib/capability-action-registry";
import { describeCapabilityAdapters } from "@/lib/capability-adapters";
import { isPersistedCapabilityApproved } from "@/lib/capability-ledger";
import {
  capabilityRequestHash,
  claimCapabilityExecution,
  completeCapabilityExecution,
} from "@/lib/capability-execution-ledger";

export async function GET() {
  return NextResponse.json({
    ok: true,
    adapterContract: "capability-adapter-v1",
    adapters: describeCapabilityAdapters(),
    actions: listCapabilityActions().map(({ packId, id, name, description, risk, requiresApproval, inputs, outputs }) => ({
      packId, id, name, description, risk, requiresApproval, inputs, outputs,
    })),
  });
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "capability-action");
  if (guard) return guard;

  const rl = rateLimit("capability-action:" + ((request.headers.get("x-forwarded-for") || "unknown").split(",")[0]));
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = runtime.identity?.tenantId ?? runtime.legacyTenant?.tenantId;
    if (!tenantId) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";
    const approved = body.approved === true;
    const missionId = typeof body.missionId === "string" ? body.missionId.trim() : undefined;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined;
    const input = body.input && typeof body.input === "object" && !Array.isArray(body.input)
      ? body.input as Record<string, unknown>
      : undefined;

    if (!actionId) return NextResponse.json({ ok: false, error: "ACTION_ID_REQUIRED" }, { status: 400 });

    const action = getCapabilityAction(actionId);
    if (!action) return NextResponse.json({ ok: false, error: "CAPABILITY_ACTION_NOT_FOUND" }, { status: 404 });

    const highRisk = action.risk === "HIGH" || action.risk === "CRITICAL";
    if (highRisk) {
      if (!missionId) return NextResponse.json({ ok: false, error: "MISSION_ID_REQUIRED_FOR_HIGH_RISK_ACTION" }, { status: 400 });
      if (!idempotencyKey) return NextResponse.json({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED_FOR_HIGH_RISK_ACTION" }, { status: 400 });
      if (!await isPersistedCapabilityApproved(missionId, actionId)) {
        return NextResponse.json({ ok: false, error: "PERSISTED_APPROVAL_REQUIRED" }, { status: 403 });
      }
    }

    let executionId: string | undefined;
    if (idempotencyKey) {
      const requestHash = capabilityRequestHash({ actionId, missionId, input });
      const claim = await claimCapabilityExecution({
        tenantId,
        missionId,
        actionId,
        idempotencyKey,
        requestHash,
      });

      if (claim.claimMode === "CONFLICT") {
        return NextResponse.json({ ok: false, error: "IDEMPOTENCY_CONFLICT", executionId: claim.executionId }, { status: 409 });
      }

      if (claim.claimMode === "REPLAY") {
        return NextResponse.json({ ok: true, replay: true, receipt: claim.receipt, executionId: claim.executionId });
      }

      if (claim.claimMode === "IN_PROGRESS") {
        return NextResponse.json({ ok: false, error: "EXECUTION_IN_PROGRESS", executionId: claim.executionId }, { status: 409 });
      }

      executionId = claim.executionId;
    }

    const quota = await consumeSaaSUsage(tenantId, 1);
    if (!quota.allowed) {
      if (executionId) {
        await completeCapabilityExecution({ executionId, status: "FAILED", errorMessage: "USAGE_LIMIT_EXCEEDED" });
      }
      return NextResponse.json({ ok: false, error: "USAGE_LIMIT_EXCEEDED", quota }, { status: 402 });
    }

    const receipt = await executeCapabilityAction({ actionId, approved, missionId, idempotencyKey, input });

    if (executionId) {
      await completeCapabilityExecution({
        executionId,
        status: receipt.status === "EXECUTED" ? "EXECUTED" : "FAILED",
        receipt: receipt as unknown as Record<string, unknown>,
        errorMessage: receipt.status === "EXECUTED" ? undefined : receipt.message,
      });
    }

    const outcome = classifyCapabilityReceipt(receipt);
    return NextResponse.json(
      { ok: outcome.ok, error: outcome.ok ? undefined : outcome.error, receipt, retryBlocked: outcome.retryBlocked || undefined, tenantId, quota, executionId },
      { status: outcome.httpStatus },
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "INVALID_REQUEST" }, { status: 400 });
  }
}
