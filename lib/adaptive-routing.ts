import type { TaskComplexity, IntelligenceMode } from "./model-intelligence";
import { classifyTaskComplexity, selectIntelligenceMode, modelsForTask } from "./model-intelligence";

export type RoutingObservation={model:string;latencyMs:number;verificationScore?:number;success?:boolean};
export type AdaptiveRoute={complexity:TaskComplexity;domain:string;mode:IntelligenceMode;models:string[];budgetMs:number;reason:string};

const NUM=(name:string,fallback:number)=>{const n=Number(process.env[name]);return Number.isFinite(n)&&n>0?n:fallback};
function cfg(){const url=(process.env.SUPABASE_URL||"").trim().replace(/\/$/,"");const key=(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||"").trim();return url&&key?{url,key}:null}
async function historical(models:string[],domain:string,complexity:number){const c=cfg();if(!c)return new Map<string,{latency:number;score:number;count:number}>();try{const r=await fetch(c.url+"/rest/v1/ce_intelligence_learning_events?select=payload&order=created_at.desc&limit=300",{headers:{apikey:c.key,Authorization:"Bearer "+c.key},cache:"no-store"});if(!r.ok)return new Map();const rows=await r.json() as Array<{payload?:Record<string,unknown>}>;const m=new Map<string,{latency:number;score:number;count:number}>();for(const row of rows){const p=row.payload||{};const model=String(p.model||"");const d=String(p.domain||"");const comp=Number(p.complexity||0);if(!models.includes(model)||d&&d!==domain||comp&&Math.abs(comp-complexity)>2)continue;const score=Number(p.verificationScore||0);if(!score)continue;const v=m.get(model)||{latency:0,score:0,count:0};v.latency+=Math.max(1,Number(p.latencyMs||0));v.score+=score;v.count++;m.set(model,v);}return m;}catch{return new Map()}}

export function adaptiveRoute(task:string, observations:RoutingObservation[]=[]):AdaptiveRoute{
  const p=classifyTaskComplexity(task); const mode=selectIntelligenceMode(p.complexity,task); let models=modelsForTask(p.domain,p.complexity);
  const trusted=observations.filter(o=>(o.success!==false)&&(o.verificationScore==null||Number(o.verificationScore)>=75)); const avg=new Map<string,{latency:number;score:number;count:number}>();
  for(const o of trusted){const v=avg.get(o.model)||{latency:0,score:0,count:0};v.latency+=Math.max(1,o.latencyMs);v.score+=o.verificationScore??75;v.count++;avg.set(o.model,v);}
  if(avg.size)models=[...models].sort((a,b)=>{const A=avg.get(a),B=avg.get(b);if(!A&&!B)return 0;if(!A)return 1;if(!B)return-1;return((B.score/B.count)-(A.score/A.count))*3+((A.latency/A.count)-(B.latency/B.count))/100;});
  const budgetMs=mode==="single"?NUM("CORE_ENGINE_SINGLE_BUDGET_MS",12000):mode==="escalation"?NUM("CORE_ENGINE_ESCALATION_BUDGET_MS",30000):NUM("CORE_ENGINE_CONSENSUS_BUDGET_MS",45000);
  return{complexity:p.complexity,domain:p.domain,mode,models,budgetMs,reason:avg.size?"adaptive:historical verified observations influence ordering":"baseline:insufficient verified observations"};
}

export async function adaptiveModelOrder(models:string[],domain:string,complexity:number){const avg=await historical(models,domain,complexity);if(!avg.size)return models.slice();return[...models].sort((a,b)=>{const A=avg.get(a),B=avg.get(b);if(!A&&!B)return 0;if(!A)return 1;if(!B)return-1;const as=A.score/A.count,bs=B.score/B.count,al=A.latency/A.count,bl=B.latency/B.count;return(bs-as)*3+(al-bl)/100;});}
