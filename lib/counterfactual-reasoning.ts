export type Counterfactual={alternative:string;expectedOutcome:number;confidence:number;assumptions:string[];difference:number;sensitivity:string};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function compareCounterfactual(input:{baselineOutcome:number;observedOutcome:number;alternativeOutcome:number;confidence:number;assumptions:string[]}):Counterfactual{
  const difference=input.alternativeOutcome-input.observedOutcome;
  const magnitude=Math.abs(difference);
  const sensitivity=magnitude<Math.abs(input.baselineOutcome)*0.05?"LOW_EFFECT":"MATERIAL_EFFECT";
  return {
    alternative:"Alternative action under the stated assumptions",
    expectedOutcome:input.alternativeOutcome,
    confidence:clamp(input.confidence),
    assumptions:input.assumptions,
    difference,
    sensitivity
  };
}

export function counterfactualGate(input:{confidence:number;materialEffect:boolean;assumptionCount:number}){
  if(input.assumptionCount===0)return {status:"HOLD",reason:"assumptions_required"};
  if(input.confidence<.6)return {status:"HOLD",reason:"counterfactual_confidence_low"};
  return {status:input.materialEffect?"RELEVANT":"LOW_SIGNAL",reason:input.materialEffect?"alternative_changes_expected_outcome":"alternative_effect_below_sensitivity_threshold"};
}
