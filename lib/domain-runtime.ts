import type { Decision, Mission } from "@/lib/engine";
import type { Diagnosis } from "@/lib/core-contracts";
import { ensureBuiltInDomainPacks } from "@/lib/domain-packs";
import { getDomainPack } from "@/lib/domain-registry";

function contractDiagnosis(decision: Decision): Diagnosis {
  return {
    summary: decision.diagnosis,
    findings: [decision.diagnosis],
    evidenceIds: decision.evidence.map((_, index) => "decision-evidence-" + index),
    confidence: decision.confidence,
    assumptions: []
  };
}

export async function buildMissionFromDomainPack(
  decision: Decision,
  domain: string | undefined,
  id: string
): Promise<Omit<Mission, "id">> {
  const now = new Date().toISOString();
  ensureBuiltInDomainPacks();
  const pack = getDomainPack(domain);

  if (pack?.buildMission) {
    const contract = await pack.buildMission({
      id: decision.id,
      recommendation: decision.recommendation,
      diagnosis: contractDiagnosis(decision)
    });
    return {
      decisionId: decision.id,
      objective: contract.objective,
      state: "AWAITING_APPROVAL",
      kpi: contract.kpi,
      createdAt: now,
      updatedAt: now,
      executionCount: 0,
      domain: contract.domain
    };
  }

  return {
    decisionId: decision.id,
    objective: domain === "trading"
      ? decision.recommendation
      : "Increase qualified checkout completion without increasing acquisition spend.",
    state: "AWAITING_APPROVAL",
    kpi: domain === "trading" ? "net_expected_r" : "checkout_completion_rate",
    createdAt: now,
    updatedAt: now,
    executionCount: 0,
    domain: domain || undefined
  };
}
