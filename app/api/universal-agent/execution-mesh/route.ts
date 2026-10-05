import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { createSession, approveSession, startExecution, recordTaskResult, recoverFailedTasks, reapproveAfterRecovery, meshHealth, certifyExecutionMesh, type MeshSession } from "@/lib/universal-agent-execution-mesh";

export async function GET() {
  return NextResponse.json({ ok: true, service: "universal-agent-execution-mesh", version: "uaem-v1", stageRange: "151-175", executionPolicy: "HUMAN_APPROVAL_REQUIRED" });
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "universal-agent-execution-mesh");
  if (guard) return guard;
  try {
    const body = await request.json();
    const action = String(body.action || "health");
    const session = body.session as MeshSession | undefined;
    if (action === "create") return NextResponse.json({ ok: true, session: createSession(String(body.runId || ""), Array.isArray(body.tasks) ? body.tasks : []) });
    if (!session) return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 400 });
    if (action === "approve") return NextResponse.json({ ok: true, session: approveSession(session) });
    if (action === "start") return NextResponse.json({ ok: true, session: startExecution(session, Array.isArray(body.taskIds) ? body.taskIds.map(String) : []) });
    if (action === "result") return NextResponse.json({ ok: true, session: recordTaskResult(session, String(body.taskId || ""), body.success === true, Array.isArray(body.evidence) ? body.evidence.map(String) : [], body.outcome) });
    if (action === "recover") return NextResponse.json({ ok: true, session: recoverFailedTasks(session) });
    if (action === "reapprove") return NextResponse.json({ ok: true, session: reapproveAfterRecovery(session) });
    if (action === "health") return NextResponse.json({ ok: true, health: meshHealth(session), certification: certifyExecutionMesh(session) });
    if (action === "certify") return NextResponse.json({ ok: true, certification: certifyExecutionMesh(session) });
    return NextResponse.json({ ok: false, error: "UNKNOWN_EXECUTION_MESH_ACTION" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "EXECUTION_MESH_OPERATION_FAILED" }, { status: 400 });
  }
}
