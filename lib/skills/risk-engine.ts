export type RiskLimits = {
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  maxGrossExposurePct: number;
  maxSpreadPoints: number;
  maxSlippagePoints: number;
};

export type RiskSnapshot = {
  equity: number;
  dailyLossPct: number;
  openPositions: number;
  grossExposurePct: number;
  spreadPoints: number;
  estimatedSlippagePoints: number;
  killSwitchActive: boolean;
};

export type RiskDecision = {
  allowed: boolean;
  reasons: string[];
};

export function evaluateRisk(
  snapshot: RiskSnapshot,
  limits: RiskLimits,
): RiskDecision {
  const reasons: string[] = [];
  if (snapshot.killSwitchActive) reasons.push("KILL_SWITCH_ACTIVE");
  if (snapshot.dailyLossPct >= limits.maxDailyLossPct) reasons.push("DAILY_LOSS_LIMIT");
  if (snapshot.openPositions >= limits.maxOpenPositions) reasons.push("MAX_OPEN_POSITIONS");
  if (snapshot.grossExposurePct >= limits.maxGrossExposurePct) reasons.push("MAX_GROSS_EXPOSURE");
  if (snapshot.spreadPoints > limits.maxSpreadPoints) reasons.push("MAX_SPREAD");
  if (snapshot.estimatedSlippagePoints > limits.maxSlippagePoints) reasons.push("MAX_SLIPPAGE");
  return { allowed: reasons.length === 0, reasons };
}

export const conservativeDefaultRiskLimits: RiskLimits = {
  maxRiskPerTradePct: 0.5,
  maxDailyLossPct: 2,
  maxOpenPositions: 3,
  maxGrossExposurePct: 10,
  maxSpreadPoints: 30,
  maxSlippagePoints: 10,
};
