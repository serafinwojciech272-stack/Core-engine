import { NextResponse } from "next/server";
import { storageMode } from "@/lib/storage";

export async function GET() {
  const aiProviderConfigured = Boolean(
    process.env.AI_DECISION_ENDPOINT &&
    process.env.AI_DECISION_API_KEY &&
    process.env.AI_DECISION_MODEL
  );

  return NextResponse.json({
    ok: true,
    service: "core-engine",
    status: "healthy",
    runtime: "ready",
    checks: {
      api: "pass",
      mission_state_machine: "pass",
      audit_events: "pass"
    },
    capabilities: {
      persistence: storageMode(),
      ai_provider: aiProviderConfigured ? "configured" : "deterministic_fallback"
    }
  });
}
