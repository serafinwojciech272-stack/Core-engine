import { NextResponse } from "next/server";
import { errorStatus, requireTenant } from "@/lib/agent-loop/http";
import { playbookCatalog } from "@/lib/agent-loop/playbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agent/playbooks — run templates for the operator panel (ADR-003).
export async function GET(request: Request) {
  try {
    await requireTenant(request);
    return NextResponse.json({ ok: true, playbooks: playbookCatalog() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PLAYBOOKS_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
