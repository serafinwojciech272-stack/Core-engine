import { NextResponse } from "next/server";
import { CORE_CONTRACT_VERSION } from "@/lib/core-contracts";
import { ENGINE_VERSION, MISSION_STATES } from "@/lib/engine";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { listCapabilityPacks } from "@/lib/capability-registry";
import { listCapabilityAdapters } from "@/lib/capability-adapters";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureCapabilityPacks();

  const packs = listCapabilityPacks();
  const actions = packs.flatMap((pack) => pack.actions);
  const adapters = listCapabilityAdapters();

  return NextResponse.json({
    ok: true,
    agent: {
      name: "Core Engine Agent",
      contractVersion: CORE_CONTRACT_VERSION,
      loop: ["OBSERVE", "CONTEXT", "EVIDENCE", "DIAGNOSE", "DECIDE", "MISSION", "APPROVAL", "EXECUTE", "MEASURE", "LEARN"],
      missionStates: MISSION_STATES,
      governance: {
        proposalBeforeExecution: true,
        explicitApprovalRequired: actions.filter((action) => action.requiresApproval).length > 0,
        humanApprovalBoundary: "APPROVAL"
      }
    },
    runtime: {
      status: "READY",
      engineVersion: ENGINE_VERSION,
      persistence: storageMode(),
      capabilityPacks: packs.length,
      capabilityActions: actions.length,
      adapters,
      executionMode: "ADAPTER",
      liveExternalSideEffects: false
    }
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
