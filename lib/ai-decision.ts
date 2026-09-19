import type { Decision, EngineSignal } from "@/lib/engine";

type DecisionPayload = Omit<Decision, "id">;

const SYSTEM_PROMPT = [
  "You are Core Engine, a business decision intelligence layer.",
  "Analyze only the supplied business signals.",
  "Return strict JSON with diagnosis, recommendation, confidence, priority, evidence.",
  "confidence must be a number from 0 to 1.",
  "priority must be HIGH, MEDIUM, or LOW.",
  "evidence must contain only concise statements grounded in the supplied signals.",
  "Do not invent metrics, facts, causes, tools, or outcomes."
].join(" ");

function deterministic(signals: EngineSignal[], domain?: string): DecisionPayload {
  const names = signals.map((s) => s.name);

  if (domain === "trading" || names.includes("instrument") || names.includes("market_regime")) {
    const get = (name: string) => signals.find((s) => s.name === name)?.value ?? "";
    const instrument = get("instrument") || "MARKET";
    const regime = get("market_regime") || "UNKNOWN";
    const momentum = Number.parseFloat(get("momentum_pct").replace("%", ""));
    const change = Number.parseFloat(get("change_pct").replace("%", ""));
    const volatility = Number.parseFloat(get("volatility_pct").replace("%", ""));
    const directional = Number.isFinite(momentum) ? momentum : Number.isFinite(change) ? change : 0;
    const absMove = Math.abs(directional);
    const confidence = Math.min(0.92, Math.max(0.5, 0.55 + Math.min(absMove, 1.0) * 0.18));
    const priority: DecisionPayload["priority"] = confidence >= 0.75 ? "HIGH" : confidence >= 0.62 ? "MEDIUM" : "LOW";
    const recommendation = regime === "TREND" && absMove > 0.08
      ? directional > 0 ? `Monitor long continuation conditions on ${instrument}; require Risk Engine validation before entry.`
        : `Monitor short continuation conditions on ${instrument}; require Risk Engine validation before entry.`
      : `WAIT on ${instrument} until market structure and probability provide sufficient edge.`;
    return {
      diagnosis: `${instrument} is currently classified as ${regime}. Momentum/change is ${Number.isFinite(directional) ? directional.toFixed(3) : "n/a"}% and volatility is ${Number.isFinite(volatility) ? volatility.toFixed(3) : "n/a"}%.`,
      recommendation,
      confidence,
      priority,
      evidence: signals.map((s) => `${s.name}: ${s.value} [${s.source}]`)
    };
  }

  if (names.includes("qualified_leads")) {
    return {
      diagnosis: "Lead volume or qualification is deteriorating while response latency is creating additional conversion risk.",
      recommendation: "Tighten lead qualification, reduce response latency, and run a controlled sales-response experiment.",
      confidence: 0.88,
      priority: "HIGH",
      evidence: signals.map((s) => `${s.name}: ${s.value} [${s.source}]`)
    };
  }

  if (names.includes("order_backlog")) {
    return {
      diagnosis: "Backlog growth is approaching operational capacity and increasing cycle-time pressure.",
      recommendation: "Prioritize bottleneck removal, rebalance capacity, and measure cycle-time reduction before adding permanent capacity.",
      confidence: 0.86,
      priority: "HIGH",
      evidence: signals.map((s) => `${s.name}: ${s.value} [${s.source}]`)
    };
  }

  return {
    diagnosis: "Traffic is growing while checkout friction is limiting conversion.",
    recommendation: "Prioritize checkout optimization and run a measured conversion experiment.",
    confidence: 0.91,
    priority: "HIGH",
    evidence: signals.map((s) => `${s.name}: ${s.value} [${s.source}]`)
  };
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/i, "");
  return JSON.parse(cleaned);
}

function validate(value: unknown, signals: EngineSignal[]): DecisionPayload | null {
  if (!value || typeof value !== "object") return null;
  const x = value as Record<string, unknown>;
  const priority = x.priority;
  const confidence = Number(x.confidence);
  const evidence = Array.isArray(x.evidence) ? x.evidence.filter((v): v is string => typeof v === "string") : [];
  if (
    typeof x.diagnosis !== "string" ||
    typeof x.recommendation !== "string" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    !["HIGH", "MEDIUM", "LOW"].includes(String(priority)) ||
    evidence.length === 0
  ) return null;

  const allowedEvidence = new Set(signals.map((s) => `${s.name}: ${s.value} [${s.source}]`));
  const groundedEvidence = evidence.filter((item) => allowedEvidence.has(item));
  return {
    diagnosis: x.diagnosis.slice(0, 1000),
    recommendation: x.recommendation.slice(0, 1000),
    confidence,
    priority: priority as Decision["priority"],
    evidence: groundedEvidence.length ? groundedEvidence.slice(0, 12) : signals.map((s) => `${s.name}: ${s.value} [${s.source}]`)
  };
}

export async function buildDecision(signals: EngineSignal[], domain?: string): Promise<Decision> {
  const fallback = deterministic(signals, domain);
  const endpoint = process.env.AI_DECISION_ENDPOINT;
  const apiKey = process.env.AI_DECISION_API_KEY;
  const model = process.env.AI_DECISION_MODEL;

  if (!endpoint || !apiKey || !model) {
    return { id: crypto.randomUUID(), ...fallback };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ signals }) }
        ]
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) throw new Error(`AI_DECISION_${response.status}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI_DECISION_EMPTY");

    const parsed = validate(extractJson(content), signals);
    if (!parsed) throw new Error("AI_DECISION_SCHEMA_INVALID");
    return { id: crypto.randomUUID(), ...parsed };
  } catch {
    return { id: crypto.randomUUID(), ...fallback };
  } finally {
    clearTimeout(timeout);
  }
}
