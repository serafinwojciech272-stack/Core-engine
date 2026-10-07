import { randomUUID } from "node:crypto";
import type { VerificationResult } from "./result-verification";

export type IntelligenceEvidence={
  requestId:string;
  engineVersion:string;
  project:string;
  mode:string;
  domain:string;
  complexity:number;
  selectedModels:string[];
  judgeModel?:string;
  toolRuns:Array<{tool:string;status:string;latencyMs?:number}>;
  verification:VerificationResult;
  approvalState:"NOT_REQUIRED"|"REQUIRED"|"BLOCKED";
  sideEffects:"NONE"|"BLOCKED_UNTIL_APPROVED";
  latencyMs:number;
  createdAt:string;
};

export function buildIntelligenceEvidence(input:Omit<IntelligenceEvidence,"requestId"|"createdAt">):IntelligenceEvidence{
  return{...input,requestId:"ce-ev-"+randomUUID(),createdAt:new Date().toISOString()};
}
