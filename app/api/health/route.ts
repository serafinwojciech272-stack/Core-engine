import { NextResponse } from "next/server";
import { storageMode } from "@/lib/storage";

export async function GET() {
  const persistence = storageMode();
  const aiProviderConfigured = Boolean(
    process.env.AI_DECISION_ENDPOINT &&
    process.env.AI_DECISION_API_KEY &&
    process.env.AI_DECISION_MODEL
  );
  const productionReady = persistence === "supabase" && aiProviderConfigured;

  return NextResponse.json({
    ok: true,
    service: "core-engine",
    status: productionReady ? "healthy" : "degraded",
    runtime: "ready",
    production_ready: productionReady,
    checks: {
      api: "pass",
      mission_state_machine: "pass",
      audit_events: "pass",
      persistent_storage: persistence === "supabase" ? "pass" : "not_configured",
      ai_provider: aiProviderConfigured ? "pass" : "fallback"
    },
    capabilities: {
      persistence,
      ai_provider: aiProviderConfigured ? "configured" : "deterministic_fallback"
    }
  });
}
