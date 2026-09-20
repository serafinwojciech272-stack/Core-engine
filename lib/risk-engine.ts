import type { EngineSignal } from "@/lib/engine";

export type RiskInput = {
  equity?: number;
  riskPct?: number;
  stopDistancePct?: number;
  spreadPct?: number;
  slippagePct?: number;
  drawdownPct?: number;
  dailyLossPct?: number;
  correlatedExposurePct?: number;
  maxRiskPct?: number;
};

export type RiskDecision = {
  gate: "PASS" | "CAUTION" | "BLOCK";
  reasons: string[];
  riskPct: number;
  positionRiskUnits: number;
  hardBlock: boolean;
  riskMode: "NORMAL" | "REDUCED" | "HALTED";
  limits: { maxRiskPct: number; maxDrawdownPct: number; maxDailyLossPct: number; maxSpreadPct: number; maxSlippagePct: number; maxCorrelatedExposurePct: number };
};

function n(signals: EngineSignal[], name: string) {
  const raw = signals.find((s) => s.name === name)?.value ?? "";
  const v = Number.parseFloat(raw.replace("%", "").replace(",", "."));
  return Number.isFinite(v) ? v : undefined;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

export function evaluateRisk(signals: EngineSignal[], expectedR: number): RiskDecision {
  const maxRiskPct = n(signals, "max_risk_pct") ?? 1.0;
  const spreadPct = n(signals, "spread_pct") ?? 0;
  const slippagePct = n(signals, "slippage_pct") ?? 0;
  const drawdownPct = n(signals, "drawdown_pct") ?? 0;
  const dailyLossPct = n(signals, "daily_loss_pct") ?? 0;
  const correlatedExposurePct = n(signals, "correlated_exposure_pct") ?? 0;
  const stopDistancePct = n(signals, "stop_distance_pct") ?? 0;

  const reasons: string[] = [];
  let gate: RiskDecision["gate"] = "PASS";
  let riskPct = clamp(maxRiskPct, 0.1, 1.5);

  if (expectedR <= 0) { gate = "BLOCK"; reasons.push("expectedR<=0"); }
  if (drawdownPct >= 10) { gate = "BLOCK"; reasons.push("drawdown>=10%"); }
  else if (drawdownPct >= 6) { gate = gate === "BLOCK" ? gate : "CAUTION"; reasons.push("drawdown>=6%"); }

  if (dailyLossPct >= 3) { gate = "BLOCK"; reasons.push("daily_loss>=3%"); }
  else if (dailyLossPct >= 2) { gate = gate === "BLOCK" ? gate : "CAUTION"; reasons.push("daily_loss>=2%"); }

  if (spreadPct >= 0.15) { gate = "BLOCK"; reasons.push("spread>=0.15%"); }
  else if (spreadPct >= 0.08) { gate = gate === "BLOCK" ? gate : "CAUTION"; reasons.push("spread>=0.08%"); }

  if (slippagePct >= 0.10) { gate = "BLOCK"; reasons.push("slippage>=0.10%"); }
  else if (slippagePct >= 0.05) { gate = gate === "BLOCK" ? gate : "CAUTION"; reasons.push("slippage>=0.05%"); }

  if (correlatedExposurePct >= 5) { gate = gate === "BLOCK" ? gate : "CAUTION"; reasons.push("correlated_exposure>=5%"); }
  if (stopDistancePct <= 0) { gate = "BLOCK"; reasons.push("stop_distance_missing"); }
  else if (stopDistancePct >= 5) { gate = "BLOCK"; reasons.push("stop_distance>=5%"); }
  if (gate === "CAUTION") riskPct *= 0.5;
  if (gate === "BLOCK") riskPct = 0;

  return {
    gate,
    reasons,
    riskPct: Number(riskPct.toFixed(3)),
    positionRiskUnits: Number((riskPct / 100).toFixed(5)),
    hardBlock: gate === "BLOCK",
    riskMode: gate === "BLOCK" ? "HALTED" : gate === "CAUTION" ? "REDUCED" : "NORMAL",
    limits: { maxRiskPct: 1.5, maxDrawdownPct: 10, maxDailyLossPct: 3, maxSpreadPct: 0.15, maxSlippagePct: 0.10, maxCorrelatedExposurePct: 5 }
  };
}
