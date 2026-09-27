import { NextResponse } from "next/server";
import { buildIntelligenceReflection } from "@/lib/intelligence-core";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      tenantId?: string; missionId?: string; problem?: string; hypothesis?: string; decision?: string; action?: string;
      expected?: { before?: number; target?: number; direction?: "higher"|"lower" };
      actual?: { before?: number; after?: number; direction?: "higher"|"lower" };
      failureReason?: string; recoveryAction?: string; domain?: string;
    };
    if (!body.tenantId || !body.problem) return NextResponse.json({ error: "TENANT_ID_AND_PROBLEM_REQUIRED" }, { status: 400 });
    const result = await buildIntelligenceReflection(body as Parameters<typeof buildIntelligenceReflection>[0]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INTELLIGENCE_REFLECTION_FAILED" }, { status: 500 });
  }
}
