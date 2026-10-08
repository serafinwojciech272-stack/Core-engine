import { NextResponse } from "next/server";

type Case = {
  id: string;
  task: string;
  artifactType?: string;
  tool?: string;
};

const cases: Case[] = [
  { id: "deterministic", task: "oblicz 2+2" },
  { id: "universal-ai", task: "Napisz jedno krótkie zdanie potwierdzające działanie Core Engine AI." },
  { id: "website", task: "stwórz stronę WWW dla restauracji w Krakowie z sekcją menu i kontaktem", artifactType: "website", tool: "multitask.website.build" },
  { id: "data", task: "przygotuj wykres KPI dla sprzedaży miesięcznej", artifactType: "data", tool: "multitask.data.analyze" },
  { id: "document", task: "utwórz dokument PDF z krótkim raportem o Core Engine AI", artifactType: "file", tool: "multitask.document.create" },
  { id: "weather", task: "sprawdź pogodę w Krakowie", artifactType: "data", tool: "multitask.weather.current" }
];

async function runCase(base: string, test: Case) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);
  try {
    const response = await fetch(base + "/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: test.task, project: "core-engine-production-verifier" }),
      cache: "no-store",
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok !== true) {
      throw new Error(`${test.id}: HTTP ${response.status}`);
    }

    const artifact = data.artifact || {};
    const verification = data.verification || {};
    const persistence = data.evidencePersistence || {};
    const runs = data.evidence?.toolRuns || [];

    if (verification.passed !== true) throw new Error(`${test.id}: verification failed`);
    if (persistence.persisted !== true) throw new Error(`${test.id}: evidence persistence failed`);

    if (test.artifactType) {
      if (artifact.type !== test.artifactType) throw new Error(`${test.id}: artifact=${artifact.type || "none"}`);
      if (artifact.status !== "EXECUTED") throw new Error(`${test.id}: artifact not executed`);
      if (!runs.length || runs[0].status !== "EXECUTED") throw new Error(`${test.id}: missing executed tool run`);
      if (test.tool && runs[0].tool !== test.tool) throw new Error(`${test.id}: tool=${runs[0].tool || "none"}`);
    }

    return {
      id: test.id,
      ok: true,
      requestId: data.performance?.requestId || null,
      artifactType: artifact.type || null,
      artifactStatus: artifact.status || null,
      tool: runs[0]?.tool || null,
      verification: verification.passed === true,
      evidencePersistence: persistence.persisted === true
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const expected = process.env.PRODUCTION_VERIFY_TOKEN?.trim();
  const supplied = request.headers.get("x-production-verify-token")?.trim();

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "PRODUCTION_VERIFIER_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!supplied || supplied !== expected) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const base = new URL(request.url).origin;
  const startedAt = Date.now();
  const results = [];

  for (const test of cases) {
    try {
      results.push(await runCase(base, test));
    } catch (error) {
      results.push({
        id: test.id,
        ok: false,
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR"
      });
      break;
    }
  }

  const passed = results.length === cases.length && results.every((result) => result.ok);

  return NextResponse.json(
    {
      ok: passed,
      verifier: "core-engine-production",
      version: "M-AI-10",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      total: cases.length,
      passed: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results
    },
    { status: passed ? 200 : 502, headers: { "Cache-Control": "no-store" } }
  );
}
