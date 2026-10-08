import { NextResponse } from "next/server";
import { adaptiveRoute } from "@/lib/adaptive-routing";
import { universalGenerate } from "@/lib/universal-ai-router";
import { verifyResult } from "@/lib/result-verification";
import { recordIntelligenceEvidence } from "@/lib/intelligence-evidence";

export async function GET(req: Request) {
  const expected = process.env.CORE_ENGINE_E2E_TOKEN?.trim();
  const url = new URL(req.url); const supplied = req.headers.get("x-core-engine-e2e")?.trim() || url.searchParams.get("token")?.trim();
  if (!expected || supplied !== expected) {
    return NextResponse.json({ ok:false, error:"E2E_AUTH_REQUIRED" }, { status:401 });
  }

  const task = "E2E verification: przygotuj krótką rekomendację architektury Core Engine AI i wyjaśnij, że jest to test end-to-end.";
  const started = Date.now();
  const route = adaptiveRoute(task);
  const multi = await universalGenerate(task);
  const text = multi.text || "E2E model execution returned no final text.";
  const verification = verifyResult(task, text);
  const evidence = await recordIntelligenceEvidence({
    engineVersion:"M-AI-10",
    project:"core-engine-e2e",
    mode:route.mode,
    domain:route.domain,
    complexity:route.complexity,
    selectedModels:[multi.model || "unknown"],
    judgeModel:undefined,
    toolRuns:[],
    verification,
    approvalState:"NOT_REQUIRED",
    sideEffects:"NONE",
    latencyMs:Date.now()-started
  });

  return NextResponse.json({
    ok: multi.text && verification.passed && evidence.persisted,
    test:"CORE_ENGINE_FULL_E2E",
    stages:{
      adaptiveRouting: route.mode === multi.mode && route.domain === multi.domain,
      aiExecution: Boolean(multi.text),
      verification: verification.passed,
      evidencePersistence: evidence.persisted
    },
    route,
    execution:{
      requestId:multi.requestId,
      provider:multi.provider,
      complexity:route.complexity,
      domain:route.domain,
      selectedModel:multi.model,
      judgeModel:undefined,
      candidateCount:1,
      errors:[],
      latencyMs:Date.now()-started
    },
    verification,
    evidence:{persisted:evidence.persisted,audit:evidence.audit,learning:evidence.learning,hash:evidence.hash}
  }, { status: multi.ok && verification.passed && evidence.persisted ? 200 : 502 });
}