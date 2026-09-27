import { NextResponse } from "next/server";
import { commercialRuntimeReadiness } from "@/lib/commercial-storage";
import { saasStatus } from "@/lib/saas-runtime";

const CONTRACT_VERSION = "commercial-agent-v2" as const;

export async function GET() {
  const readiness = commercialRuntimeReadiness();
  return NextResponse.json({
    ok: true,
    contract: CONTRACT_VERSION,
    product: {
      model: "MULTI_TENANT_SAAS",
      identity: "SUPABASE_AUTH",
      tenancy: "TENANT_WORKSPACE",
      metering: "DATABASE_ENFORCED",
      billing: "INTERNAL_PLAN_V1",
      autonomy: "HUMAN_APPROVED",
      execution: "SIMULATION_ONLY",
      durableState: "SUPABASE_REQUIRED_FOR_PRODUCTION"
    },
    runtime: { saas: saasStatus(), commercial: readiness },
    plans: [
      { id: "free", monthlyUnits: 100 },
      { id: "starter", monthlyUnits: 1000 },
      { id: "growth", monthlyUnits: 10000 },
      { id: "enterprise", monthlyUnits: null }
    ],
    governance: { approvalRequiredForHighRiskActions: true, liveExternalSideEffects: false, failClosedRiskGate: true }
  });
}
