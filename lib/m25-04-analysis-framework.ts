import type { CoreEngineDomain } from "@/lib/m25-01-domain-router";
import { getDomainPolicies } from "@/lib/m25-02-domain-policy-registry";

export type AnalysisFramework = {
  domains: CoreEngineDomain[];
  methods:string[];
  metrics:string[];
  scenarios:string[];
  riskRules:string[];
  confidenceRules:string[];
  outputSections:string[];
};

export function buildAnalysisFramework(domains: readonly CoreEngineDomain[]): AnalysisFramework {
  const policies=getDomainPolicies(domains);
  return {
    domains:[...domains],
    methods:[...new Set(policies.flatMap(p=>p.preferredMethods))],
    metrics:[...new Set(policies.flatMap(p=>p.requiredMetrics))],
    scenarios:[...new Set(policies.flatMap(p=>p.scenarioTypes))],
    riskRules:[...new Set(policies.flatMap(p=>p.riskRules))],
    confidenceRules:[...new Set(policies.flatMap(p=>p.confidenceRules))],
    outputSections:[...new Set(policies.flatMap(p=>p.outputSections))],
  };
}
