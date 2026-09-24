import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { executeCapabilityAction, listCapabilityActions } from "@/lib/capability-action-registry";

export async function GET() {
  return NextResponse.json({
    ok: true,
    actions: listCapabilityActions().map(({ packId, id, name, description, risk, requiresApproval, inputs, outputs }) => ({
      packId, id, name, description, risk, requiresApproval, inputs, outputs
    }))
  });
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "capability-action");
  if (guard) return guard;
  const rl = rateLimit("capability-action:" + ((request.headers.get("x-forwarded-for") || "unknown").split(",")[0]));
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";
    const approved = body.approved === true;
    const missionId = typeof body.missionId === "string" ? body.missionId.trim() : undefined;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined;
    if (!actionId) return NextResponse.json({ ok: false, error: "ACTION_ID_REQUIRED" }, { status: 400 });

    const receipt = await executeCapabilityAction({ actionId, approved, missionId, idempotencyKey });
    if (receipt.status === "NOT_FOUND") return NextResponse.json({ ok: false, receipt }, { status: 404 });
    if (receipt.status === "APPROVAL_REQUIRED") return NextResponse.json({ ok: false, receipt }, { status: 403 });
    if (receipt.status === "ADAPTER_NOT_FOUND") return NextResponse.json({ ok: false, receipt }, { status: 501 });
    if (receipt.status === "FAILED") return NextResponse.json({ ok: false, receipt }, { status: 502 });
    return NextResponse.json({ ok: true, receipt });
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }
}
