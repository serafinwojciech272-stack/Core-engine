import { guardMutation } from "@/lib/http";
import { NextResponse } from "next/server";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { storageMode } from "@/lib/storage";
import { tenantMissionIds } from "@/lib/commercial-storage";
import { runMissionLearningLoop } from "@/lib/learning-loop";

export async function POST(request: Request) {
  { const guard = guardMutation(request, "intelligence-learn"); if (guard) return guard; }
  const runtime = await resolveSaaSContext(request);
  const tenant = runtime.identity ? { tenantId: runtime.identity.tenantId } : runtime.legacyTenant;
  if (!tenant) return NextResponse.json({ ok: false, error: "TENANT_REQUIRED" }, { status: 401 });
  if (storageMode() !== "supabase") {
    return NextResponse.json({ ok: false, error: "LEARNING_REQUIRES_SUPABASE" }, { status: 409 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = typeof body?.missionId === "string" ? body.missionId : "";
    if (!missionId) return NextResponse.json({ ok: false, error: "MISSION_ID_REQUIRED" }, { status: 400 });

    const ids = new Set(await tenantMissionIds(tenant.tenantId));
    if (!ids.has(missionId)) return NextResponse.json({ ok: false, error: "MISSION_NOT_FOUND" }, { status: 404 });

    const result = await runMissionLearningLoop({
      tenantId: tenant.tenantId,
      missionId,
      domain: typeof body?.domain === "string" ? body.domain : undefined
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[core-engine] learning loop failed", error);
    return NextResponse.json({ ok: false, error: "LEARNING_PROMOTION_FAILED" }, { status: 503 });
  }
}
