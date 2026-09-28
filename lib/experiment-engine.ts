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

type DbConfig={url:string;key:string};
function cfg():DbConfig{const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key};}
function headers(key:string){return{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};}

export async function persistExperiment(input:{tenantId:string;hypothesisId?:string;missionId?:string;design:ExperimentDesign}){
  const c=cfg();
  const r=await fetch(c.url+"/rest/v1/ce_intelligence_experiments",{method:"POST",cache:"no-store",headers:{...headers(c.key),Prefer:"return=representation"},body:JSON.stringify({
    tenant_id:input.tenantId,hypothesis_id:input.hypothesisId??null,mission_id:input.missionId??null,
    name:input.design.name,baseline:input.design.baseline,intervention:input.design.intervention,
    success_criteria:input.design.successCriteria,guardrails:input.design.guardrails,status:"DESIGNED"
  })});
  if(!r.ok)throw new Error("EXPERIMENT_DB_"+r.status);
  return (await r.json() as unknown[])[0]??null;
}

export async function recordExperimentResult(input:{tenantId:string;experimentId:string;baseline:number;observed:number;direction:"higher"|"lower";minEffect:number;confidence:number;observations?:unknown[]}){
  const evaluation=evaluateExperiment(input);
  const c=cfg();
  const r=await fetch(c.url+"/rest/v1/ce_intelligence_experiments?id=eq."+encodeURIComponent(input.experimentId)+"&tenant_id=eq."+encodeURIComponent(input.tenantId),{
    method:"PATCH",cache:"no-store",headers:{...headers(c.key),Prefer:"return=representation"},
    body:JSON.stringify({result:evaluation.result,effect_size:evaluation.effectSize,confidence:input.confidence,observations:input.observations??[],status:"COMPLETED",updated_at:new Date().toISOString()})
  });
  if(!r.ok)throw new Error("EXPERIMENT_RESULT_DB_"+r.status);
  return {evaluation,experiment:(await r.json() as unknown[])[0]??null};
}
