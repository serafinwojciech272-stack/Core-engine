import { NextResponse } from "next/server";
import { recallIntelligence } from "@/lib/intelligence-core";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tenantId?: string; query?: string; domain?: string; limit?: number };
    if (!body.tenantId || !body.query) return NextResponse.json({ error: "TENANT_ID_AND_QUERY_REQUIRED" }, { status: 400 });
    const memories = await recallIntelligence(body as { tenantId: string; query: string; domain?: string; limit?: number });
    return NextResponse.json({ memories, count: memories.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INTELLIGENCE_RECALL_FAILED" }, { status: 500 });
  }
}
