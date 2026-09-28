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

type DbConfig={url:string;key:string};
function cfg():DbConfig{const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key};}
function headers(key:string){return{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};}

export async function persistHypothesis(input:HypothesisInput){
  const h=generateHypothesis(input);
  const c=cfg();
  const response=await fetch(c.url+"/rest/v1/ce_intelligence_hypotheses",{
    method:"POST",cache:"no-store",headers:{...headers(c.key),Prefer:"return=representation"},
    body:JSON.stringify({
      tenant_id:input.tenantId,mission_id:input.missionId??null,domain:input.domain??null,
      problem:input.problem,hypothesis:h.hypothesis,rationale:h.rationale,assumptions:h.assumptions,
      predictions:h.predictions,experiment_plan:h.experimentPlan,
      unknown_ids:(input.unknowns??[]).map(x=>x.id).filter((x):x is string=>typeof x==="string"),
      evidence_refs:input.evidence??[],prior_probability:h.priorProbability,confidence:h.confidence,status:"PROPOSED"
    })
  });
  if(!response.ok)throw new Error("HYPOTHESIS_DB_"+response.status);
  return (await response.json() as unknown[])[0]??null;
}

export async function recordHypothesisOutcome(input:{tenantId:string;hypothesisId:string;predicted:boolean;observed:boolean;confidence:number;outcome:Record<string,unknown>}){
  const status=classifyHypothesisOutcome(input);
  const c=cfg();
  const response=await fetch(c.url+"/rest/v1/ce_intelligence_hypotheses?id=eq."+encodeURIComponent(input.hypothesisId)+"&tenant_id=eq."+encodeURIComponent(input.tenantId),{
    method:"PATCH",cache:"no-store",headers:{...headers(c.key),Prefer:"return=representation"},
    body:JSON.stringify({status,outcome:input.outcome,updated_at:new Date().toISOString()})
  });
  if(!response.ok)throw new Error("HYPOTHESIS_OUTCOME_DB_"+response.status);
  return {status,hypothesis:(await response.json() as unknown[])[0]??null};
}
