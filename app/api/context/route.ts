import { NextResponse } from "next/server";
import { buildContextEvidence } from "@/lib/context-evidence-runtime";
import { guardMutation } from "@/lib/http";

export async function POST(request: Request) {
  const guard = guardMutation(request, "context");
  if (guard) return guard;

  try {
    const body = await request.json();
    if (!Array.isArray(body?.signals) || !Array.isArray(body?.evidence)) {
      return NextResponse.json({ ok: false, error: "CONTEXT_INPUT_REQUIRED" }, { status: 400 });
    }

    const result = buildContextEvidence({
      signals: body.signals,
      evidence: body.evidence,
      domain: typeof body.domain === "string" ? body.domain : undefined,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined
    });

    return NextResponse.json({
      ok: true,
      stage: "CONTEXT_EVIDENCE",
      context: result.context,
      evidence: result.evidence,
      evidenceGraph: result.evidenceGraph,
      evidenceQuality: result.evidenceQuality,
      evidenceCount: result.evidence.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CONTEXT_RUNTIME_FAILED";
    const status = message.includes("REQUIRED") || message.includes("INVALID") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
