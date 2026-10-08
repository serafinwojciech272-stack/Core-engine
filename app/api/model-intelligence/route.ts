import { NextResponse } from "next/server";
import { intelligenceReadiness, modelRegistry } from "@/lib/model-intelligence";
import { intelligenceRouterReadiness, routeIntelligenceTask } from "@/lib/m12-intelligence-router";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "core-engine-intelligence-fabric",
    version: "M12",
    readiness: {
      ...intelligenceReadiness(),
      router: intelligenceRouterReadiness()
    },
    models: modelRegistry(),
    sideEffects: "APPROVAL_REQUIRED"
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { task?: unknown };
    const task = typeof body.task === "string" ? body.task.trim() : "";
    if (!task) return NextResponse.json({ ok: false, error: "TASK_REQUIRED" }, { status: 400 });
    return NextResponse.json({ ok: true, route: routeIntelligenceTask(task) });
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
}
