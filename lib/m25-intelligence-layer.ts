import { routeCoreEngineDomain, type DomainRoute } from "@/lib/m25-01-domain-router";
import { getDomainPolicies } from "@/lib/m25-02-domain-policy-registry";
import { assessEvidence } from "@/lib/m25-03-evidence-requirements";
import { buildAnalysisFramework } from "@/lib/m25-04-analysis-framework";
import { buildScenarioSet } from "@/lib/m25-05-scenario-engine";
import { assessConfidence } from "@/lib/m25-06-confidence-engine";
import { synthesizeDecision, type IntelligenceDecision } from "@/lib/m25-07-decision-synthesis";
import { buildIntelligenceOutput, type IntelligenceOutput } from "@/lib/m25-08-intelligence-output-contract";
import { bridgeIntelligenceToM24, type M25M24BridgeResult } from "@/lib/m25-09-m24-integrity-bridge";

export type CoreEngineIntelligenceRequest = {
  request: string;
  providedEvidence?: string[];
  assumptions?: string[];
  risks?: string[];
  dataFresh?: boolean;
  conflicts?: number;
};

export type CoreEngineIntelligenceResult = {
  route: DomainRoute;
  policies: ReturnType<typeof getDomainPolicies>;
  evidence: ReturnType<typeof assessEvidence>;
  framework: ReturnType<typeof buildAnalysisFramework>;
  intelligence: IntelligenceOutput;
  m24Bridge: M25M24BridgeResult | null;
};

export function runCoreEngineIntelligence(input: CoreEngineIntelligenceRequest): CoreEngineIntelligenceResult {
  const route = routeCoreEngineDomain(input.request);
  const policies = getDomainPolicies(route.domains);
  const evidence = assessEvidence(route.domains, input.providedEvidence ?? []);
  const framework = buildAnalysisFramework(route.domains);
  const scenarios = buildScenarioSet({
    names: framework.scenarios.length ? framework.scenarios.slice(0, 3) : undefined,
    assumptions: input.assumptions ?? [],
    invalidation: framework.riskRules,
  });
  const confidence = assessConfidence({
    evidenceSufficient: evidence.sufficient,
    domainCount: route.domains.length,
    dataFresh: input.dataFresh ?? false,
    assumptionCount: input.assumptions?.length ?? 0,
    conflicts: input.conflicts ?? 0,
  });
  const decision: IntelligenceDecision = synthesizeDecision({
    domains: route.domains,
    evidenceSufficient: evidence.sufficient,
    scenarios,
    confidence,
    assumptions: input.assumptions ?? [],
    risks: input.risks ?? framework.riskRules,
  });
  const intelligence = buildIntelligenceOutput({
    route,
    framework,
    decision,
    observed: input.providedEvidence ?? [],
    inferred: framework.methods,
    decided: decision.decision === "ANALYZE" ? ["PROCEED_TO_M24_APPROVAL_CONTROL"] : [],
  });
  return {
    route,
    policies,
    evidence,
    framework,
    intelligence,
    m24Bridge: null,
  };
}

export function authorizeCoreEngineIntelligenceForM24(
  result: CoreEngineIntelligenceResult,
  tenantId: string,
  requestId: string,
): CoreEngineIntelligenceResult {
  return {
    ...result,
    m24Bridge: bridgeIntelligenceToM24({
      tenantId,
      requestId,
      decision: result.intelligence.decision,
    }),
  };
}
