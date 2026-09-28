export type ExperimentDesign={name:string;baseline:Record<string,unknown>;intervention:Record<string,unknown>;successCriteria:string[];guardrails:string[]};

export function designExperiment(input:{problem:string;hypothesis:string;baselineMetric:string;targetMetric:string;intervention:string}):ExperimentDesign{
  return {
    name:"Test: "+input.hypothesis.slice(0,180),
    baseline:{metric:input.baselineMetric,problem:input.problem},
    intervention:{action:input.intervention,targetMetric:input.targetMetric},
    successCriteria:[
      "Baseline is measured before intervention.",
      "Target metric changes in the predicted direction.",
      "Observed change is attributable to the intervention within the defined window."
    ],
    guardrails:[
      "Use the smallest reversible intervention.",
      "Abort if safety, compliance, financial or operational limits are breached.",
      "Do not promote a strategy from one experiment."
    ]
  };
}

export function evaluateExperiment(input:{baseline:number;observed:number;direction:"higher"|"lower";minEffect:number;confidence:number}){
  const delta=input.observed-input.baseline;
  const effect=input.baseline===0?delta:delta/Math.abs(input.baseline);
  const directional=input.direction==="higher"?delta>=0:delta<=0;
  if(input.confidence<0.7)return {result:"INCONCLUSIVE",effectSize:effect};
  if(directional && Math.abs(effect)>=Math.abs(input.minEffect))return {result:"SUPPORTED",effectSize:effect};
  return {result:"REFUTED",effectSize:effect};
}
