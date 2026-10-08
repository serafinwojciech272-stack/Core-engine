import { NextResponse } from "next/server";
import { modelRegistry, modelRegistryReadiness } from "@/lib/m11-model-registry";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "core-engine-model-registry",
    version: "M11",
    readiness: modelRegistryReadiness(),
    models: modelRegistry(),
    credentials: "NOT_EXPOSED"
  }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } });
}
