import type { DecisionContract, DomainPack, MissionContract } from "@/lib/core-contracts";

function buildMission(decision: DecisionContract): MissionContract {
  return {
    id: crypto.randomUUID(),
    decisionId: decision.id,
    domain: "trading",
    objective: decision.recommendation,
    kpi: "net_expected_r",
    state: "AWAITING_APPROVAL",
    requiredApproval: true
  };
}

export const tradingDomainPack: DomainPack = {
  id: "trading",
  version: "1.0.0",
  description: "Trading decision mission mapping with explicit approval boundary.",
  signals: ["instrument", "market_regime", "momentum_pct", "volatility_pct"],
  diagnose: (context) => ({
    summary: "Trading context is delegated to the trading decision engine for domain-specific diagnosis.",
    findings: ["Trading signals received", "Risk and multi-timeframe validation remain mandatory"],
    evidenceIds: context.signals.map((_, index) => "trading-signal-" + index),
    confidence: 0.5,
    assumptions: []
  }),
  buildMission
};
