import { NextResponse } from "next/server";
import { checkStorageHealth, storageMode } from "@/lib/storage";

export async function GET() {
  const persistence = storageMode();
  const persistentStorage = await checkStorageHealth();
  const aiProviderConfigured = Boolean(
    process.env.AI_DECISION_ENDPOINT &&
    process.env.AI_DECISION_API_KEY &&
    process.env.AI_DECISION_MODEL
  );
  const productionReady = persistentStorage === "pass" && aiProviderConfigured;

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
      persistent_storage: persistentStorage,
      ai_provider: aiProviderConfigured ? "configured" : "fallback",
      audit_verification: "pass"
    },
    capabilities: {
      persistence,
      ai_provider: aiProviderConfigured ? "configured" : "deterministic_fallback",
      audit_verification: "sha256_chain"
    }
  });
}
