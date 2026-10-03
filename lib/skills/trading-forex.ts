import type { SkillDefinition } from "./types";

export const forexTradingSkill: SkillDefinition = {
  id: "trading.forex",
  version: "1.0.0",
  name: "Forex Trading",
  description: "Research, simulate, validate and govern FX trading workflows with explicit risk gates.",
  domain: "trading",
  capabilities: [
    { id: "market.read", description: "Read market and account state.", riskLevel: "LOW", modes: ["OBSERVATIONAL", "SIMULATION", "SHADOW", "LIVE"], requiredTools: ["market-data"] },
    { id: "strategy.analyze", description: "Evaluate a configured strategy against current market state.", riskLevel: "MEDIUM", modes: ["OBSERVATIONAL", "SIMULATION", "SHADOW", "LIVE"], requiredTools: ["market-data"] },
    { id: "trade.propose", description: "Produce a structured trade proposal without sending an order.", riskLevel: "MEDIUM", modes: ["SIMULATION", "SHADOW", "LIVE"], requiredTools: ["market-data", "risk-engine"] },
    { id: "trade.validate", description: "Run pre-trade risk and policy gates.", riskLevel: "HIGH", modes: ["SIMULATION", "SHADOW", "LIVE"], requiredTools: ["risk-engine"] },
    { id: "trade.execute", description: "Send an approved order through a broker adapter.", riskLevel: "CRITICAL", modes: ["LIVE"], requiredTools: ["broker-adapter", "risk-engine"] },
    { id: "trade.monitor", description: "Monitor positions, exposure and execution health.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], requiredTools: ["broker-adapter", "risk-engine"] },
    { id: "trade.reconcile", description: "Reconcile broker state with the internal ledger.", riskLevel: "HIGH", modes: ["SHADOW", "LIVE"], requiredTools: ["broker-adapter", "ledger"] }
  ],
  policies: [
    "LIVE execution requires explicit approval and a passing risk gate.",
    "No strategy may bypass position, exposure, loss, spread or broker-health limits.",
    "Demo and shadow execution must remain isolated from live credentials.",
    "Every order proposal and execution must produce durable evidence and an outcome record."
  ],
  verification: ["backtest", "paper-trading", "shadow-trading", "pre-trade-risk", "post-trade-reconciliation", "outcome-calibration"],
  learningPolicy: "Learn from resolved outcomes only; never promote a single trade into a strategy rule."
};
