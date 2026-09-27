import { NextResponse } from "next/server";
import { getAgentManifest } from "@/lib/agent-contract";
import { getProductionReadiness } from "@/lib/production-readiness";
import { storageMode } from "@/lib/storage";
import { listCapabilityAdapters } from "@/lib/capability-adapters";
import { listCapabilityPacks } from "@/lib/capability-registry";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { commercialRuntimeStatus } from "@/lib/commercial-runtime";
import { commercialRuntimeReadiness } from "@/lib/commercial-storage";
import { saasStatus } from "@/lib/saas-runtime";

export async function GET() {
  ensureCapabilityPacks();
  const manifest = getAgentManifest();
  const persistence = storageMode();

  return NextResponse.json({
    ok: true,
    agent: manifest,
    runtime: {
      status: "READY",
      persistence,
      durable: persistence === "supabase",
      adapters: listCapabilityAdapters(),
      capabilityPacks: listCapabilityPacks().length,
      execution: getProductionReadiness().execution,
      liveExternalSideEffects: false,
      approvalRequiredForHighRiskActions: true,
      commercialRuntime: commercialRuntimeStatus(),
      commercialReadiness: commercialRuntimeReadiness(),
      saas: saasStatus()
    },
    integration: {
      plan: "POST /api/engine",
      missionControl: "POST /api/mission",
      capabilityDiscovery: "GET /api/capabilities",
      health: "GET /api/health"
    }
  }, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30" }
  });
}
