export type LearningOutcome={predictionCorrect:boolean;actualOutcome:string;notes?:string};
export type LearningSignal={status:"LEARNED"|"INSUFFICIENT_OUTCOME";calibrationDelta:number;signals:string[]};
export function evaluateLearningFeedback(input:{predicted:string;outcome?:LearningOutcome}):LearningSignal{
  if(!input.outcome) return {status:"INSUFFICIENT_OUTCOME",calibrationDelta:0,signals:["OUTCOME_PENDING"]};
  const same=input.predicted.trim().toLowerCase()===input.outcome.actualOutcome.trim().toLowerCase();
  return {status:"LEARNED",calibrationDelta:same?0.02:-0.02,signals:[same?"PREDICTION_MATCH":"PREDICTION_MISS",...(input.outcome.notes?[input.outcome.notes]:[])]};
}
