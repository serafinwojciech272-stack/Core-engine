import { NextResponse } from "next/server";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { listPersistedPredictions, storageMode } from "@/lib/storage";
import { buildCalibrationSummary } from "@/lib/prediction-calibration";
import { tenantMissionIds } from "@/lib/commercial-storage";

export async function GET(request: Request) {
  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = runtime.identity?.tenantId || runtime.legacyTenant?.tenantId;
    if (!tenantId) return NextResponse.json({ ok:false, error:"TENANT_REQUIRED" }, { status:401 });
    if (storageMode() !== "supabase") return NextResponse.json({ ok:false, error:"CALIBRATION_REQUIRES_SUPABASE" }, { status:409 });
    const missionIds = new Set(await tenantMissionIds(tenantId));
    const entries = (await listPersistedPredictions(200)).filter(entry => missionIds.has(entry.missionId));
    return NextResponse.json({
      ok: true,
      version: "M10.10",
      tenantId,
      calibration: buildCalibrationSummary(entries),
      predictions: entries.slice(0, 50)
    });
  } catch (error) {
    console.error("[core-engine] calibration read failed", error);
    return NextResponse.json({ ok:false, error:"CALIBRATION_READ_FAILED" }, { status:503 });
  }
}
