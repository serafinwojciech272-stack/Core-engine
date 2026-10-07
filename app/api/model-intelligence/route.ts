import { NextResponse } from "next/server";
import { intelligenceReadiness, modelRegistry } from "@/lib/model-intelligence";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "core-engine-intelligence-fabric",
    version: "M-AI-01/02/03",
    readiness: intelligenceReadiness(),
    models: modelRegistry(),
    sideEffects: "APPROVAL_REQUIRED"
  });
}
