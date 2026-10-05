import type { DomainRoute } from "@/lib/m25-01-domain-router";
import type { AnalysisFramework } from "@/lib/m25-04-analysis-framework";
import type { IntelligenceDecision } from "@/lib/m25-07-decision-synthesis";
export type IntelligenceOutput={route:DomainRoute;framework:AnalysisFramework;decision:IntelligenceDecision;observed:string[];inferred:string[];decided:string[];disclaimer:string};
export function buildIntelligenceOutput(input:Omit<IntelligenceOutput,"disclaimer">):IntelligenceOutput{
  return {...input,disclaimer:"Analiza rozdziela obserwacje, inferencje i decyzje. Wyniki zależą od jakości, aktualności i kompletności danych."};
}
