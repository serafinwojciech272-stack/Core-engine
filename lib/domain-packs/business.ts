import type { Context, Diagnosis, Evidence, MissionContract } from "@/lib/core-contracts";
import { validateConfidence } from "@/lib/core-contracts";
import type { DomainPack } from "@/lib/core-contracts";

const names = (context: Context) => context.signals.map((s) => s.name);

function diagnose(context: Context, evidence: Evidence[]): Diagnosis {
  const signalNames = names(context);
  const evidenceIds = evidence.map((item) => item.id);
  if (signalNames.includes("qualified_leads")) {
    return {
      summary: "Lead qualification or response performance is deteriorating based on supplied sales signals.",
      findings: ["qualified_leads signal is present", "response and conversion metrics should be measured together"],
      evidenceIds,
      confidence: validateConfidence(0.8),
      assumptions: ["Supplied CRM and analytics signals are current enough for operational diagnosis."]
    };
  }
  if (signalNames.includes("order_backlog")) {
    return {
      summary: "Backlog growth is creating cycle-time pressure against supplied operational capacity signals.",
      findings: ["order_backlog signal is present", "cycle-time impact should be verified before capacity changes"],
      evidenceIds,
      confidence: validateConfidence(0.8),
      assumptions: ["Backlog values use a consistent measurement definition."]
    };
  }
  if (signalNames.includes("checkout_dropoff")) {
    return {
      summary: "Checkout friction is the strongest conversion constraint represented in the supplied signals.",
      findings: ["checkout_dropoff signal is present", "conversion impact should be measured with a controlled experiment"],
      evidenceIds,
      confidence: validateConfidence(0.82),
      assumptions: ["Checkout drop-off is measured consistently across the supplied period."]
    };
  }
  return {
    summary: "The supplied business signals do not support a specific high-confidence diagnosis.",
    findings: ["Additional domain-specific KPI evidence is required"],
    evidenceIds,
    confidence: validateConfidence(0.5),
    assumptions: ["The supplied signal set is representative of the current business state."]
  };
}

function buildMission(decision: { id: string; recommendation: string; diagnosis: Diagnosis }): MissionContract {
  const lead = decision.diagnosis.summary.includes("Lead");
  const ops = decision.diagnosis.summary.includes("Backlog");
  return {
    id: crypto.randomUUID(),
    decisionId: decision.id,
    domain: "business",
    objective: lead
      ? "Increase qualified lead conversion while reducing response latency."
      : ops
        ? "Reduce operational cycle time without compromising service quality."
        : "Increase qualified checkout completion without increasing acquisition spend.",
    kpi: lead ? "lead_to_opportunity_rate" : ops ? "cycle_time" : "checkout_completion_rate",
    state: "AWAITING_APPROVAL",
    requiredApproval: true
  };
}

export const businessDomainPack: DomainPack = {
  id: "business",
  version: "1.0.0",
  description: "Universal business diagnosis and mission mapping.",
  signals: ["qualified_leads", "response_latency_minutes", "conversion_rate", "order_backlog", "checkout_dropoff"],
  diagnose,
  buildMission
};
