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
    if (!actionId) return NextResponse.json({ ok: false, error: "ACTION_ID_REQUIRED" }, { status: 400 });

    const receipt = executeCapabilityAction({ actionId, approved });
    if (receipt.status === "NOT_FOUND") return NextResponse.json({ ok: false, receipt }, { status: 404 });
    if (receipt.status === "APPROVAL_REQUIRED") return NextResponse.json({ ok: false, receipt }, { status: 403 });
    return NextResponse.json({ ok: true, receipt });
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }
}
