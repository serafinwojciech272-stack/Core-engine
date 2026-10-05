import type { CoreEngineDomain } from "@/lib/m25-01-domain-router";
import { getDomainPolicies } from "@/lib/m25-02-domain-policy-registry";

export type EvidenceRequirement = { id:string; description:string; required:boolean; freshnessHours?:number };
export type EvidenceAssessment = { sufficient:boolean; missing:string[]; requirements:EvidenceRequirement[] };

const freshnessByDomain: Partial<Record<CoreEngineDomain,number>>={EQUITY:168,FX_MACRO:48,SPORTS_BETTING:6,REAL_ESTATE:720,BUSINESS:2160,FORECASTING:168,MARKET_NICHES:720};

export function buildEvidenceRequirements(domains: readonly CoreEngineDomain[]): EvidenceRequirement[] {
  const result: EvidenceRequirement[]=[];
  for(const p of getDomainPolicies(domains)){
    for(const input of p.requiredInputs) result.push({id:`${p.domain}:${input}`,description:`${p.domain}: ${input}`,required:true,freshnessHours:freshnessByDomain[p.domain]});
  }
  return [...new Map(result.map(x=>[x.id,x])).values()];
}

export function assessEvidence(domains: readonly CoreEngineDomain[], provided: readonly string[]): EvidenceAssessment {
  const normalized=new Set(provided.map(x=>x.toLowerCase().trim()));
  const requirements=buildEvidenceRequirements(domains);
  const missing=requirements.filter(r=>r.required&&!Array.from(normalized).some(v=>r.description.toLowerCase().includes(v)||v.includes(r.id.toLowerCase()))).map(r=>r.id);
  return {sufficient:missing.length===0,missing,requirements};
}
