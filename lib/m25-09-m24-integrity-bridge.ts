import { createHash } from "node:crypto";
import type { IntelligenceDecision } from "@/lib/m25-07-decision-synthesis";
export type M25M24BridgeResult={allowed:boolean;decisionHash:string|null;state:"READY_FOR_M24"|"BLOCKED";failures:string[]};
export function bridgeIntelligenceToM24(input:{tenantId:string;requestId:string;decision:IntelligenceDecision}):M25M24BridgeResult{
  const failures:string[]=[];
  if(!input.tenantId) failures.push("M25_TENANT_MISSING");
  if(!input.requestId) failures.push("M25_REQUEST_ID_MISSING");
  if(input.decision.decision!=="ANALYZE") failures.push("M25_DECISION_NOT_ACTIONABLE");
  if(!input.decision.decisionHash) failures.push("M25_DECISION_HASH_MISSING");
  if(failures.length) return {allowed:false,decisionHash:null,state:"BLOCKED",failures};
  const decisionHash=createHash("sha256").update(JSON.stringify({tenantId:input.tenantId,requestId:input.requestId,m25DecisionHash:input.decision.decisionHash})).digest("hex");
  return {allowed:true,decisionHash,state:"READY_FOR_M24",failures:[]};
}
