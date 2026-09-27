import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext, consumeSaaSUsage } from "@/lib/saas-runtime";
import { getCapabilityAction, executeCapabilityAction, listCapabilityActions } from "@/lib/capability-action-registry";
import { isPersistedCapabilityApproved } from "@/lib/capability-ledger";

export async function GET() {
  return NextResponse.json({ ok: true, actions: listCapabilityActions().map(({ packId, id, name, description, risk, requiresApproval, inputs, outputs }) => ({ packId, id, name, description, risk, requiresApproval, inputs, outputs })) });
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "capability-action"); if (guard) return guard;
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
    const input = body.input && typeof body.input === "object" && !Array.isArray(body.input) ? body.input as Record<string, unknown> : undefined;
    if (!actionId) return NextResponse.json({ ok: false, error: "ACTION_ID_REQUIRED" }, { status: 400 });

    const action = getCapabilityAction(actionId);
    if (!action) return NextResponse.json({ ok: false, error: "CAPABILITY_ACTION_NOT_FOUND" }, { status: 404 });
    if (action.risk === "HIGH" || action.risk === "CRITICAL") {
      if (!missionId) return NextResponse.json({ ok: false, error: "MISSION_ID_REQUIRED_FOR_HIGH_RISK_ACTION" }, { status: 400 });
      if (!await isPersistedCapabilityApproved(missionId, actionId)) return NextResponse.json({ ok: false, error: "PERSISTED_APPROVAL_REQUIRED" }, { status: 403 });
    }

    const quota = await consumeSaaSUsage(tenantId, 1);
    if (!quota.allowed) return NextResponse.json({ ok: false, error: "USAGE_LIMIT_EXCEEDED", quota }, { status: 402 });

    const receipt = await executeCapabilityAction({ actionId, approved, missionId, idempotencyKey, input });
    if (receipt.status === "APPROVAL_REQUIRED") return NextResponse.json({ ok: false, receipt }, { status: 403 });
    if (receipt.status === "ADAPTER_NOT_FOUND") return NextResponse.json({ ok: false, receipt }, { status: 501 });
    if (receipt.status === "FAILED") return NextResponse.json({ ok: false, receipt }, { status: 502 });
    return NextResponse.json({ ok: true, receipt, tenantId, quota });
  } catch { return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 }); }
}
