export type HypothesisInput = {
  tenantId: string;
  problem: string;
  domain?: string;
  missionId?: string;
  unknowns?: Array<{ id?: string; question: string; importance?: string }>;
  evidence?: Array<{ ref?: string; claim?: string; confidence?: number }>;
};

export type Hypothesis = {
  hypothesis: string;
  rationale: string;
  assumptions: string[];
  predictions: string[];
  experimentPlan: string[];
  priorProbability: number;
  confidence: number;
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function generateHypothesis(input: HypothesisInput): Hypothesis {
  const unknowns=input.unknowns??[];
  const evidence=input.evidence??[];
  const strongest=unknowns.find(u=>u.importance==="CRITICAL")??unknowns.find(u=>u.importance==="HIGH")??unknowns[0];
  const evidenceConfidence=evidence.length?evidence.reduce((s,e)=>s+clamp(e.confidence??0.5),0)/evidence.length:0.35;
  const hypothesis=strongest
    ? "The unresolved factor ""+strongest.question+"" is materially contributing to the observed problem ""+input.problem.slice(0,300)+""."
    : "A measurable change in the primary operating constraint is materially contributing to the observed problem ""+input.problem.slice(0,300)+"".";
  const rationale=strongest
    ? "The hypothesis targets the highest-priority unresolved variable instead of treating an unknown as a fact."
    : "The hypothesis is intentionally testable and does not assert an unverified causal explanation as fact.";
  const predictions=[
    "The predicted factor should correlate with the problem metric when measured over a defined period.",
    "A controlled intervention on the factor should move the target metric in the predicted direction."
  ];
  const experimentPlan=[
    "Define the baseline metric and observation window.",
    "Collect independent evidence for the proposed causal factor.",
    "Run the smallest reversible intervention that isolates the factor.",
    "Compare outcome with baseline and record the result in Experience Memory."
  ];
  return {hypothesis,rationale,assumptions:strongest?["Unknown remains unresolved: "+strongest.question]:["Primary constraint is measurable"],predictions,experimentPlan,priorProbability:0.5,confidence:clamp(0.35+evidenceConfidence*0.45)};
}

export function classifyHypothesisOutcome(input:{predicted:boolean;observed:boolean;confidence:number}){
  if(input.predicted===input.observed && input.confidence>=0.7)return input.observed?"SUPPORTED":"REFUTED";
  return "TESTING";
}
