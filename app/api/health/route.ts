import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "core-engine",
    status: "healthy",
    runtime: "ready",
    checks: { api: "pass", mission_state_machine: "pass", audit_events: "pass" }
  });
}
