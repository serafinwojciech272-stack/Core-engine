import { NextResponse } from "next/server";
import { buildDecision } from "@/lib/ai-decision";
import { buildContextEvidence } from "@/lib/context-evidence-runtime";
import type { EvidenceInput } from "@/lib/evidence-engine";
import type { EngineSignal } from "@/lib/engine";
import { rateLimit } from "@/lib/rate-limit";

const MAX_PROBLEM = 2400;

const labels = {
  pl: { disclaimer: "Demo inwestorskie. Analiza jest ilustracyjna i nie korzysta z prywatnych systemów biznesowych odwiedzającego.", missing: ["Dane źródłowe z systemów pierwszej strony (CRM, analityka, ERP) nie są podłączone w publicznym demo.","Brak historycznej serii czasowej uniemożliwia ocenę trendu i sezonowości.","Hipoteza wymaga eksperymentu lub obserwacji wyniku przed wykonaniem działania."], policy: "DOWODY → HIPOTEZA → ODWRACALNY EKSPERYMENT → POMIAR → UCZENIE", execution: "ZABLOKOWANE W DEMO — WYMAGA AKCEPTACJI CZŁOWIEKA", uncertainty: ["WYSOKA","ISTOTNA","UMIARKOWANA"], approval: "WYMAGA AKCEPTACJI CZŁOWIEKA" },
  en: { disclaimer: "Investor demonstration. Analysis is illustrative and does not access the visitor's private business systems.", missing: ["First-party source data (CRM, analytics, ERP) is not connected in the public demo.","No historical time series is available to assess trend or seasonality.","The hypothesis requires an experiment or outcome observation before any action is executed."], policy: "EVIDENCE → HYPOTHESIS → REVERSIBLE EXPERIMENT → MEASURE → LEARN", execution: "BLOCKED IN DEMO — HUMAN APPROVAL REQUIRED", uncertainty: ["HIGH","MATERIAL","MODERATE"], approval: "HUMAN APPROVAL REQUIRED" },
  de: { disclaimer: "Investor-Demo. Die Analyse ist illustrativ und greift nicht auf private Geschäftssysteme des Besuchers zu.", missing: ["First-Party-Daten aus CRM, Analytics oder ERP sind im öffentlichen Demo nicht verbunden.","Keine historische Zeitreihe zur Bewertung von Trend und Saisonalität verfügbar.","Die Hypothese erfordert ein Experiment oder eine Ergebnisbeobachtung vor jeder Ausführung."], policy: "NACHWEISE → HYPOTHESE → REVERSIBLES EXPERIMENT → MESSUNG → LERNEN", execution: "IM DEMO BLOCKIERT — FREIGABE DURCH MENSCHEN ERFORDERLICH", uncertainty: ["HOCH","ERHEBLICH","MODERAT"], approval: "MENSCHLICHE FREIGABE ERFORDERLICH" },
  zh: { disclaimer: "投资者演示。该分析仅用于展示，不会访问访客的私有业务系统。", missing: ["公开演示未连接 CRM、分析或 ERP 等第一方数据源。","没有历史时间序列，无法评估趋势和季节性。","在执行任何操作前，需要通过实验或结果观察验证假设。"], policy: "证据 → 假设 → 可逆实验 → 衡量 → 学习", execution: "演示中已阻止 — 需要人工审批", uncertainty: ["高","显著","中等"], approval: "需要人工审批" }
} as const;

type DemoLang = keyof typeof labels;
function getLang(value: unknown): DemoLang { return value === "en" || value === "de" || value === "zh" ? value : "pl"; }

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
    const lang = getLang(body.lang);
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
    const confidence = Number(decision.confidence || 0);
    const evidenceGaps = [...labels[lang].missing];
    const nextEvidence = domain === "sales"
      ? ["czas odpowiedzi per etap lejka", "konwersja lead → szansa → wygrana", "segmentacja źródeł leadów"]
      : domain === "operations"
        ? ["backlog per proces", "czas cyklu i kolejki", "obciążenie zasobów per etap"]
        : ["lejek wejście → checkout → zakup", "konwersja per źródło ruchu", "odrzucenia i błędy na checkout"];
    const uncertainty = confidence >= 0.8 ? labels[lang].uncertainty[2] : confidence >= 0.55 ? labels[lang].uncertainty[1] : labels[lang].uncertainty[0];
    const missionProposal = {
      id: `INV-DEMO-${Date.now().toString(36).toUpperCase()}`,
      objective: decision.recommendation,
      hypothesis: decision.diagnosis,
      requiredEvidence: nextEvidence,
      acceptanceCriteria: ["Baseline KPI captured", "Reversible experiment completed", "Outcome measured against baseline"],
      proposedActions: actionPlan(decision.recommendation, domain).slice(0, 4),
      guardrails: ["SIMULATION_ONLY", "NO_EXTERNAL_SIDE_EFFECTS", "HUMAN_APPROVAL_REQUIRED"],
      approvalState: "AWAITING_APPROVAL",
      executionMode: "SIMULATION_ONLY",
      missionProposal,
      trace: ["DECIDE", "MISSION", "APPROVAL"]
    };

    return NextResponse.json({
      ok: true,
      demo: true,
      synthetic: true,
      disclaimer: labels[lang].disclaimer,
      lang,
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
      explainability: {
        confidence,
        uncertainty,
        evidenceGaps,
        nextEvidence,
        policy: labels[lang].policy,
        execution: labels[lang].execution
      },
      trace: [
        { stage: "OBSERVE", status: "COMPLETE", output: problem },
        { stage: "CONTEXT", status: "COMPLETE", output: domain },
        { stage: "EVIDENCE", status: "COMPLETE", output: context.evidenceQuality.score },
        { stage: "DIAGNOSE", status: "COMPLETE", output: decision.diagnosis },
        { stage: "DECIDE", status: "COMPLETE", output: decision.recommendation },
        { stage: "MISSION", status: "PROPOSED", output: missionProposal.id },
        { stage: "APPROVAL", status: "REQUIRED", output: labels[lang].approval }
      ]
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[investor-demo] request failed", error);
    return NextResponse.json({ ok: false, error: "INVESTOR_ANALYSIS_FAILED" }, { status: 503 });
  }
}
