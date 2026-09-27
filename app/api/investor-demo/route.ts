import { NextResponse } from "next/server";
import { buildDecision } from "@/lib/ai-decision";
import { buildContextEvidence } from "@/lib/context-evidence-runtime";
import type { EvidenceInput } from "@/lib/evidence-engine";
import type { EngineSignal } from "@/lib/engine";
import { rateLimit } from "@/lib/rate-limit";

const MAX_PROBLEM = 2400;

function inferSignals(problem: string): { domain: string; signals: EngineSignal[] } {
  const text = problem.toLowerCase();
  const signals: EngineSignal[] = [
    { name: "business_problem", value: problem.slice(0, 800), source: "investor_demo" }
  ];
  let domain = "business";

  const rules: Array<[string, string, RegExp]> = [
    ["growth", "conversion_rate", /(conversion|konwers|checkout|koszyk|sprzedaż|sales|revenue|przychod)/i],
    ["sales", "qualified_leads", /(lead|leady|pipeline|deal|szans|klient.*pozysk|pozysk.*klient)/i],
    ["sales", "response_time", /(response|odpowied|kontakt|reply|follow.?up)/i],
    ["operations", "order_backlog", /(backlog|zaleg|zamów|order|opóźn|operac|proces|cycle.?time)/i],
    ["operations", "cost_pressure", /(koszt|cost|marż|margin|capacity|wydajno|zasob)/i],
    ["growth", "customer_retention", /(churn|retention|retenc|utrzym|odejść|rezygn)/i],
    ["growth", "traffic", /(traffic|ruch|visits|odwiedz|marketing|kampan)/i]
  ];

  const seen = new Set<string>();
  for (const [candidateDomain, name, pattern] of rules) {
    if (pattern.test(text)) {
      domain = candidateDomain;
      if (!seen.has(name)) {
        seen.add(name);
        signals.push({ name, value: "mentioned in problem statement", source: "investor_demo" });
      }
    }
  }

  const percentage = problem.match(/(?:^|\\s)([-+]?\\d+(?:[.,]\\d+)?)\\s*%/);
  if (percentage) signals.push({ name: "stated_metric_pct", value: percentage[1].replace(",", ".") + "%", source: "investor_demo" });

  return { domain, signals: signals.slice(0, 12) };
}

function actionPlan(recommendation: string, domain: string) {
  const common = [
    "Validate the diagnosis against first-party business evidence.",
    "Define one measurable KPI and a baseline before changing the system.",
    "Run the smallest reversible experiment that can confirm or reject the hypothesis.",
    "Measure the outcome and feed the result back into the learning loop."
  ];
  if (domain === "sales") common.splice(1, 0, "Segment the sales funnel and isolate the largest conversion or latency bottleneck.");
  if (domain === "operations") common.splice(1, 0, "Map the process bottleneck and quantify capacity, cycle time and queue impact.");
  if (domain === "growth") common.splice(1, 0, "Break the customer journey into acquisition, conversion and retention constraints.");
  return [{ action: recommendation, priority: "PRIMARY" }, ...common.map((action) => ({ action, priority: "NEXT" }))];
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const rl = rateLimit("investor-demo:" + ip);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16000) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    }
    const body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    const problem = typeof body.problem === "string" ? body.problem.trim() : "";
    if (problem.length < 12) return NextResponse.json({ ok: false, error: "PROBLEM_TOO_SHORT" }, { status: 400 });
    if (problem.length > MAX_PROBLEM) return NextResponse.json({ ok: false, error: "PROBLEM_TOO_LONG" }, { status: 400 });

    const { domain, signals } = inferSignals(problem);
    const evidence: EvidenceInput[] = signals.map((signal) => ({
      claim: signal.name === "business_problem" ? signal.value : signal.name + " = " + signal.value,
      source: signal.source
    }));
    const context = buildContextEvidence({ signals, evidence, domain });
    const decision = await buildDecision(signals, domain, []);

    return NextResponse.json({
      ok: true,
      demo: true,
      synthetic: true,
      disclaimer: "Investor demonstration. Analysis is illustrative and does not access the visitor's private business systems.",
      domain,
      context: context.context,
      evidence: context.evidence,
      evidenceQuality: context.evidenceQuality,
      decision,
      solution: {
        diagnosis: decision.diagnosis,
        recommendation: decision.recommendation,
        confidence: decision.confidence,
        priority: decision.priority,
        actions: actionPlan(decision.recommendation, domain)
      },
      trace: [
        { stage: "OBSERVE", status: "COMPLETE", output: problem },
        { stage: "CONTEXT", status: "COMPLETE", output: domain },
        { stage: "EVIDENCE", status: "COMPLETE", output: context.evidenceQuality.score },
        { stage: "DIAGNOSE", status: "COMPLETE", output: decision.diagnosis },
        { stage: "DECIDE", status: "COMPLETE", output: decision.recommendation },
        { stage: "APPROVAL", status: "REQUIRED", output: "No external action is executed from the public demo." }
      ]
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[investor-demo] request failed", error);
    return NextResponse.json({ ok: false, error: "INVESTOR_ANALYSIS_FAILED" }, { status: 503 });
  }
}
