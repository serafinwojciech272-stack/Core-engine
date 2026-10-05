import { createHash } from "node:crypto";
import type { CoreEngineDomain } from "@/lib/m25-01-domain-router";
import type { ConfidenceResult } from "@/lib/m25-06-confidence-engine";
import type { ScenarioSet } from "@/lib/m25-05-scenario-engine";
export type IntelligenceDecision={decision:"ANALYZE"|"INSUFFICIENT_DATA"|"BLOCKED";domains:CoreEngineDomain[];scenarios:ScenarioSet;confidence:ConfidenceResult;assumptions:string[];risks:string[];decisionHash:string|null};
export function synthesizeDecision(input:{domains:CoreEngineDomain[];evidenceSufficient:boolean;scenarios:ScenarioSet;confidence:ConfidenceResult;assumptions:string[];risks:string[]}):IntelligenceDecision{
  if(!input.domains.length||!input.evidenceSufficient||input.confidence.band==="LOW") return {decision:"INSUFFICIENT_DATA",domains:input.domains,scenarios:input.scenarios,confidence:input.confidence,assumptions:input.assumptions,risks:input.risks,decisionHash:null};
  const payload={domains:input.domains,scenarios:input.scenarios.scenarios,confidence:input.confidence,assumptions:input.assumptions,risks:input.risks,decision:"ANALYZE"};
  return {...payload,decision:"ANALYZE",scenarios:input.scenarios,decisionHash:createHash("sha256").update(JSON.stringify(payload)).digest("hex")};
}
