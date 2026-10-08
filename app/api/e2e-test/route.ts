import { NextResponse } from "next/server";
import { adaptiveRoute } from "@/lib/adaptive-routing";
import { multiModelGenerate } from "@/lib/multi-model-execution";
import { verifyResult } from "@/lib/result-verification";
import { recordIntelligenceEvidence } from "@/lib/intelligence-evidence";

export async function GET(req: Request) {
  const expected = process.env.CORE_ENGINE_E2E_TOKEN?.trim();
  const url = new URL(req.url); const supplied = req.headers.get("x-core-engine-e2e")?.trim() || url.searchParams.get("token")?.trim();
  if (!expected || supplied !== expected) {
    return NextResponse.json({ ok:false, error:"E2E_AUTH_REQUIRED" }, { status:401 });
  }

  const task = "E2E verification: zaprojektuj i porównaj architekturę Core Engine AI, przeanalizuj routing modeli oraz zaproponuj konkretną implementację testu end-to-end; wskaż ryzyka i sposób weryfikacji.";
  const started = Date.now();
  const route = adaptiveRoute(task);
  const multi = await multiModelGenerate(task);
  const text = multi.text || "E2E model execution returned no final text.";
  const verification = verifyResult(task, text);
  const evidence = await recordIntelligenceEvidence({
    engineVersion:"M-AI-10",
    project:"core-engine-e2e",
    mode:multi.mode,
    domain:multi.domain,
    complexity:multi.complexity,
    selectedModels:multi.candidates.map(c=>c.model),
    judgeModel:multi.judgeModel,
    toolRuns:[],
    verification,
    approvalState:"NOT_REQUIRED",
    sideEffects:"NONE",
    latencyMs:Date.now()-started
  });

  return NextResponse.json({
    ok: multi.ok && verification.passed && evidence.persisted,
    test:"CORE_ENGINE_FULL_E2E",
    stages:{
      adaptiveRouting: route.mode === multi.mode && route.domain === multi.domain,
      multiModelExecution: multi.ok,
      verification: verification.passed,
      evidencePersistence: evidence.persisted
    },
    route,
    execution:{
      requestId:multi.requestId,
      mode:multi.mode,
      complexity:multi.complexity,
      domain:multi.domain,
      selectedModel:multi.selectedModel,
      judgeModel:multi.judgeModel,
      candidateCount:multi.candidates.length,
      errors:multi.errors,
      latencyMs:Date.now()-started
    },
    verification,
    evidence:{persisted:evidence.persisted,audit:evidence.audit,learning:evidence.learning,hash:evidence.hash}
  }, { status: multi.ok && verification.passed && evidence.persisted ? 200 : 502 });
}