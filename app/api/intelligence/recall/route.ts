import { authorizeTenant, guardMutation } from "@/lib/http";
import { NextResponse } from "next/server";
import { recallIntelligence } from "@/lib/intelligence-core";

export async function POST(request: Request) {
  { const guard = guardMutation(request, "intelligence-recall"); if (guard) return guard; }
  const auth = await authorizeTenant(request); if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as { tenantId?: string; query?: string; domain?: string; limit?: number };
    if (!body.query) return NextResponse.json({ error: "QUERY_REQUIRED" }, { status: 400 });
    // Tenant comes from authentication only; a body tenantId is ignored (cross-tenant read fix).
    const memories = await recallIntelligence({ query: body.query, domain: body.domain, limit: body.limit, tenantId: auth.tenantId });
    return NextResponse.json({ memories, count: memories.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INTELLIGENCE_RECALL_FAILED" }, { status: 500 });
  }
}
