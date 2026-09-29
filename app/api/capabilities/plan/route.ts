import { NextResponse } from "next/server";
import { planGrowthCapabilities } from "@/lib/capability-planner";
import { ensureCapabilityPacks } from "@/lib/capability-packs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const objective = typeof body?.objective === "string" ? body.objective.trim().slice(0, 2000) : "";
    if (objective.length < 3) return NextResponse.json({ ok:false, error:"OBJECTIVE_REQUIRED" }, { status:400 });
    ensureCapabilityPacks();
    const plan = planGrowthCapabilities({
      objective,
      diagnosis: typeof body?.diagnosis === "string" ? body.diagnosis.slice(0, 4000) : undefined,
      recommendation: typeof body?.recommendation === "string" ? body.recommendation.slice(0, 4000) : undefined,
      signals: Array.isArray(body?.signals) ? body.signals.filter((x: unknown): x is string => typeof x === "string").slice(0, 30) : undefined
    });
    return NextResponse.json({ ok:true, contract:"capability-plan-v1", plan });
  } catch {
    return NextResponse.json({ ok:false, error:"CAPABILITY_PLAN_FAILED" }, { status:503 });
  }
}
