import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { QUALITY_CASES, certifyQuality } from "@/lib/agent-quality";
import { fallbackAgent } from "@/app/api/agent/route";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: "qa-v1",
    totalCases: QUALITY_CASES.length,
    cases: QUALITY_CASES.map((c) => ({ id: c.id, task: c.task })),
  });
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "agent-quality");
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const supplied =
      body?.outputs && typeof body.outputs === "object" ? body.outputs : {};
    const outputs: Record<string, any> = {};

    for (const c of QUALITY_CASES) {
      outputs[c.id] = supplied[c.id] || fallbackAgent(c.task, []);
    }

    const report = certifyQuality(outputs);
    return NextResponse.json({
      ok: true,
      report,
      gate: report.certified ? "PASS" : "FAIL",
      control: {
        sideEffects: "BLOCKED_UNTIL_APPROVED",
        approvalRequired: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "QUALITY_FAILED",
      },
      { status: 400 },
    );
  }
}
