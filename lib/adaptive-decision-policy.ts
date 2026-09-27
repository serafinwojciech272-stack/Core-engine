import type { PredictiveDecision } from "@/lib/predictive-decision";
import type { PredictionLedgerEntry } from "@/lib/storage";

export type DecisionPolicyMode = "EXPLORE" | "BALANCED" | "CONSERVATIVE" | "ABSTAIN";
export type DecisionPolicy = {
  version:"m9.7-adaptive-v1";
  mode:DecisionPolicyMode;
  actionThreshold:number;
  evidenceThreshold:number;
  confidenceThreshold:number;
  maxRisk:"LOW"|"MEDIUM"|"HIGH";
  explorationRate:number;
  rationale:string[];
  adaptations:string[];
  sampleSize:number;
  calibrationStatus:"UNAVAILABLE"|"WEAK"|"CALIBRATING"|"CALIBRATED";
};

export function buildAdaptiveDecisionPolicy(input:{
  prediction:PredictiveDecision;
  history?:PredictionLedgerEntry[];
  learningCount?:number;
}):DecisionPolicy {
  const history=input.history??[];
  const resolved=history.filter(x=>x.outcomeStatus==="WON"||x.outcomeStatus==="LOST");
  const sampleSize=resolved.length;
  const wins=resolved.filter(x=>x.outcomeStatus==="WON").length;
  const hitRate=sampleSize?wins/sampleSize:null;
  const calibrationStatus=sampleSize<5?"UNAVAILABLE":sampleSize<15?"WEAK":sampleSize<30?"CALIBRATING":"CALIBRATED";
  const recent=resolved.slice(0,10);
  const recentLosses=recent.filter(x=>x.outcomeStatus==="LOST").length;
  const recentWinRate=recent.length?recent.filter(x=>x.outcomeStatus==="WON").length/recent.length:null;
  const rationale:string[]=[];
  const adaptations:string[]=[];
  let mode:DecisionPolicyMode="BALANCED";
  let actionThreshold=.65;
  let evidenceThreshold=.6;
  let confidenceThreshold=.62;
  let maxRisk:"LOW"|"MEDIUM"|"HIGH"="MEDIUM";
  let explorationRate=.12;

  if(sampleSize<5){
    mode="EXPLORE"; actionThreshold=.72; evidenceThreshold=.68; confidenceThreshold=.68; maxRisk="MEDIUM"; explorationRate=.2;
    rationale.push("Insufficient resolved outcomes for reliable calibration.");
    adaptations.push("Require stronger evidence while collecting diverse outcome data.");
  } else if((recentWinRate!==null&&recentWinRate<.45)||(recentLosses>=6)){
    mode="CONSERVATIVE"; actionThreshold=.8; evidenceThreshold=.75; confidenceThreshold=.75; maxRisk="LOW"; explorationRate=.05;
    rationale.push("Recent resolved outcomes show elevated failure frequency.");
    adaptations.push("Raise action and evidence thresholds; restrict accepted risk.");
  } else if(hitRate!==null&&hitRate>=.7&&sampleSize>=15&&input.prediction.confidence>=.72){
    mode="BALANCED"; actionThreshold=.6; evidenceThreshold=.55; confidenceThreshold=.58; maxRisk="MEDIUM"; explorationRate=.15;
    rationale.push("Historical outcome quality supports calibrated execution thresholds.");
    adaptations.push("Lower friction for sufficiently evidenced decisions while preserving risk gates.");
  } else {
    mode="BALANCED"; rationale.push("Outcome history is informative but not strong enough for aggressive adaptation.");
    adaptations.push("Keep baseline thresholds and continue calibration.");
  }

  if(input.prediction.risk==="HIGH"){
    mode=mode==="EXPLORE"?"ABSTAIN":"CONSERVATIVE";
    actionThreshold=Math.max(actionThreshold,.82);
    evidenceThreshold=Math.max(evidenceThreshold,.78);
    confidenceThreshold=Math.max(confidenceThreshold,.78);
    maxRisk="LOW";
    explorationRate=Math.min(explorationRate,.04);
    rationale.push("Current predictive risk is HIGH.");
    adaptations.push("Require explicit high-confidence evidence before progression.");
  }

  if(input.prediction.outcome==="UNCERTAIN"){
    actionThreshold=Math.max(actionThreshold,.78);
    evidenceThreshold=Math.max(evidenceThreshold,.72);
    rationale.push("Predictive outcome is UNCERTAIN.");
    adaptations.push("Prefer observation and evidence collection over irreversible action.");
  }

  return {
    version:"m9.7-adaptive-v1",mode,actionThreshold,evidenceThreshold,confidenceThreshold,maxRisk,
    explorationRate,rationale,adaptations,sampleSize,calibrationStatus
  };
}
