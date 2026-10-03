export type TradeProposal = {
  proposalId: string;
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  riskPct: number;
  expectedR: number;
  rationale: string[];
  evidenceIds: string[];
  mode: "SIMULATION" | "SHADOW" | "LIVE";
  status: "PROPOSED" | "VALIDATED" | "REJECTED" | "APPROVAL_REQUIRED";
};

export function validateTradeProposalShape(proposal: TradeProposal): string[] {
  const errors: string[] = [];
  if (!proposal.proposalId.trim()) errors.push("PROPOSAL_ID_REQUIRED");
  if (!proposal.symbol.trim()) errors.push("SYMBOL_REQUIRED");
  if (!Number.isFinite(proposal.entryPrice) || proposal.entryPrice <= 0) errors.push("ENTRY_PRICE_INVALID");
  if (!Number.isFinite(proposal.stopLoss) || proposal.stopLoss <= 0) errors.push("STOP_LOSS_INVALID");
  if (!Number.isFinite(proposal.takeProfit) || proposal.takeProfit <= 0) errors.push("TAKE_PROFIT_INVALID");
  if (!Number.isFinite(proposal.quantity) || proposal.quantity <= 0) errors.push("QUANTITY_INVALID");
  if (!Number.isFinite(proposal.riskPct) || proposal.riskPct <= 0) errors.push("RISK_PCT_INVALID");
  if (proposal.evidenceIds.length === 0) errors.push("EVIDENCE_REQUIRED");
  if (proposal.rationale.length === 0) errors.push("RATIONALE_REQUIRED");
  return errors;
}
