import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { assessMastery, dailyMaster, generateRoadmap, loadMastery, researchMastery } from "@/lib/mastery-engine/runtime";
import type { MasteryAction } from "@/lib/mastery-engine/contracts";

export async function GET(request: Request) {
  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = runtime.identity?.tenantId || runtime.legacyTenant?.tenantId;
    if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_NOT_CONFIGURED" }, { status: 401 });
    const state = await loadMastery(tenantId);
    return NextResponse.json({ ok: true, state, identity: runtime.identity ? { tenantId: runtime.identity.tenantId, workspaceId: runtime.identity.workspaceId, role: runtime.identity.role } : null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "MASTERY_READ_FAILED" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "mastery");
  if (guard) return guard;
  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = runtime.identity?.tenantId || runtime.legacyTenant?.tenantId;
    if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_NOT_CONFIGURED" }, { status: 401 });
    const body = await request.json() as { action?: MasteryAction; answers?: string; topic?: string };
    const action = body.action || "bootstrap";
    if (action === "bootstrap") return NextResponse.json({ ok: true, state: await loadMastery(tenantId) });
    if (action === "roadmap") return NextResponse.json({ ok: true, roadmap: await generateRoadmap(tenantId) });
    if (action === "assess") {
      if (!body.answers?.trim()) return NextResponse.json({ ok: false, error: "ANSWERS_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, profile: await assessMastery(tenantId, body.answers.slice(0, 12000)) });
    }
    if (action === "daily") return NextResponse.json({ ok: true, daily: await dailyMaster(tenantId) });
    if (action === "research") {
      if (!body.topic?.trim()) return NextResponse.json({ ok: false, error: "TOPIC_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, research: await researchMastery(tenantId, body.topic.slice(0, 300)) });
    }
    return NextResponse.json({ ok: false, error: "UNKNOWN_MASTERY_ACTION" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "MASTERY_OPERATION_FAILED" }, { status: 503 });
  }
}
