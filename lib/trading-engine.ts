import type { EngineSignal } from "@/lib/engine";
import { evaluateRisk } from "@/lib/risk-engine";

export type TradingAnalysis = {
  instrument: string; regime: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  momentumPct: number; changePct: number; volatilityPct: number;
  edgeScore: number; confidence: number;
  probabilities: { p1R: number; p2R: number; p3R: number };
  expectedR: number; riskGate: "PASS" | "CAUTION" | "BLOCK";
  decision: "LONG_WATCH" | "SHORT_WATCH" | "WAIT";
  reasons: string[]; methodology: "deterministic-heuristic-v1";
};

function valueOf(signals: EngineSignal[], name: string): string {
  return signals.find((s) => s.name === name)?.value ?? "";
}

function percent(value: string): number {
  const n = Number.parseFloat(value.replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }

export function analyzeTrading(signals: EngineSignal[]): TradingAnalysis {
  const instrument = valueOf(signals, "instrument") || "MARKET";
  const regime = valueOf(signals, "market_regime") || "UNKNOWN";
  const momentumPct = percent(valueOf(signals, "momentum_pct"));
  const changePct = percent(valueOf(signals, "change_pct"));
  const volatilityPct = Math.max(0, percent(valueOf(signals, "volatility_pct")));
  const primary = Math.abs(momentumPct) >= 0.01 ? momentumPct : changePct;
  const direction: TradingAnalysis["direction"] = primary > 0.01 ? "LONG" : primary < -0.01 ? "SHORT" : "NEUTRAL";
  const trendBonus = regime === "TREND" ? 0.18 : regime === "RANGE" ? -0.06 : 0;
  const momentumScore = clamp(Math.abs(primary) / 0.5, 0, 1);
  const volatilityPenalty = clamp(volatilityPct / 1.5, 0, 1) * 0.35;
  const edgeScore = clamp(0.5 + trendBonus + momentumScore * 0.30 - volatilityPenalty, 0, 1);
  const baseRiskGate: TradingAnalysis["riskGate"] = volatilityPct >= 1.0 ? "BLOCK" : volatilityPct >= 0.35 ? "CAUTION" : "PASS";
  const directionalEdge = direction === "NEUTRAL" ? 0 : edgeScore;
  const confidence = clamp(0.50 + directionalEdge * 0.42 - (baseRiskGate === "BLOCK" ? 0.16 : baseRiskGate === "CAUTION" ? 0.06 : 0), 0.5, 0.92);
  const p1R = clamp(0.38 + confidence * 0.40, 0, 0.78);
  const p2R = clamp(0.18 + confidence * 0.30, 0, 0.58);
  const p3R = clamp(0.08 + confidence * 0.20, 0, 0.42);
  const expectedR = Number(((p1R + p2R * 0.65 + p3R * 0.35) - (1 - p1R) * 0.8).toFixed(3));
  const risk = evaluateRisk(signals, expectedR);\n  const riskGate: TradingAnalysis["riskGate"] = risk.gate === "PASS" && baseRiskGate === "PASS" ? "PASS" : risk.gate === "BLOCK" || baseRiskGate === "BLOCK" ? "BLOCK" : "CAUTION";\n  const actionable = riskGate !== "BLOCK" && regime === "TREND" && Math.abs(primary) > 0.08 && confidence >= 0.62;
  const decision: TradingAnalysis["decision"] = actionable && direction === "LONG" ? "LONG_WATCH" : actionable && direction === "SHORT" ? "SHORT_WATCH" : "WAIT";
  const reasons = [
    "Regime=" + regime,
    "directional_move=" + primary.toFixed(3) + "%",
    "volatility=" + volatilityPct.toFixed(3) + "%",
    "risk_gate=" + riskGate,\n    ...risk.reasons.map((reason) => "risk=" + reason),
    "confidence=" + confidence.toFixed(3),
  ];
  return { instrument, regime, direction, momentumPct, changePct, volatilityPct, edgeScore: Number(edgeScore.toFixed(3)), confidence: Number(confidence.toFixed(3)), { p1R: Number(p1R.toFixed(3)), p2R: Number(p2R.toFixed(3)), p3R: Number(p3R.toFixed(3)) }, expectedR, riskGate, decision, reasons, methodology: "deterministic-heuristic-v1" };
}