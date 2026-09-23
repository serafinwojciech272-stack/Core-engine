import type { DecisionContract, DomainPack, MissionContract } from "@/lib/core-contracts";

function buildMission(decision: DecisionContract): MissionContract {
  return {
    id: crypto.randomUUID(),
    decisionId: decision.id,
    domain: "tender",
    objective: decision.recommendation,
    kpi: "tender_decision_quality",
    state: "AWAITING_APPROVAL",
    requiredApproval: true
  };
}

export const tenderDomainPack: DomainPack = {
  id: "tender",
  version: "1.0.0",
  description: "Evidence-first procurement and tender mission mapping.",
  signals: ["tender_notice", "deadline", "buyer", "competitor", "requirements"],
  diagnose: (context) => ({
    summary: "Tender context requires evidence-backed procurement diagnosis before action.",
    findings: ["Tender signals received", "Source evidence must remain traceable"],
    evidenceIds: context.signals.map((_, index) => "tender-signal-" + index),
    confidence: 0.5,
    assumptions: []
  }),
  buildMission
};
