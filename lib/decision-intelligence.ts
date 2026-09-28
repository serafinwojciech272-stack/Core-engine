export type DecisionOption={id:string;action:string;expectedBenefit:number;confidence:number;downside:number;reversibility:number;evidenceStrength:number;effort:number};

export type DecisionAssessment={optionId:string;utility:number;confidence:number;reasons:string[]};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function assessDecision(options:DecisionOption[]):DecisionAssessment[]{
  return options.map(o=>{
    const benefit=clamp(o.expectedBenefit);
    const confidence=clamp(o.confidence);
    const evidence=clamp(o.evidenceStrength);
    const downside=clamp(o.downside);
    const reversible=clamp(o.reversibility);
    const effort=clamp(o.effort);
    const utility=clamp(.32*benefit+.24*confidence+.18*evidence+.16*reversible+.10*(1-effort)-.28*downside);
    const reasons=[
      confidence<.5?"Low confidence requires more evidence before consequential execution.":"Confidence is sufficient for controlled evaluation.",
      evidence<.5?"Evidence is weak or incomplete.":"Evidence strength supports the current assessment.",
      downside>.5?"Downside risk is material; prefer a bounded/reversible step.":"Downside is within the current guardrail.",
      reversible>.7?"The option is highly reversible.":"Reversibility is limited."
    ];
    return {optionId:o.id,utility,confidence:clamp(.55*confidence+.45*evidence),reasons};
  });
}

export function decisionGate(input:{assessment:DecisionAssessment;approvalRequired:boolean;criticalRisk:boolean}){
  if(input.criticalRisk)return {status:"BLOCKED",reason:"critical_risk"};
  if(input.approvalRequired)return {status:"AWAITING_APPROVAL",reason:"approval_gate_required"};
  if(input.assessment.confidence<.6)return {status:"RESEARCH_REQUIRED",reason:"confidence_below_execution_threshold"};
  return {status:"READY_FOR_CONTROLLED_EXECUTION",reason:"decision_guardrails_satisfied"};
}
