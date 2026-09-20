import type { Decision } from "@/lib/engine";
export type DecisionMatrix={action:"LONG_WATCH"|"SHORT_WATCH"|"WAIT";gate:"PASS"|"CAUTION"|"BLOCK";reasons:string[];methodology:"deterministic-matrix-v1"};
export function buildDecisionMatrix(decision:Decision):DecisionMatrix{
 const gate=decision.riskGate??"BLOCK"; const action=gate==="BLOCK"?"WAIT":decision.recommendation.includes("LONG")?"LONG_WATCH":decision.recommendation.includes("SHORT")?"SHORT_WATCH":"WAIT";
 return {action,gate,reasons:[`risk_gate=${gate}`,`confidence=${decision.confidence.toFixed(3)}`,`expectedR=${decision.expectedR??"UNAVAILABLE"}`,`mtf=${decision.multiTimeframe?.alignment??"UNAVAILABLE"}`],methodology:"deterministic-matrix-v1"};
}