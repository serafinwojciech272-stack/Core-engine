import type { TaskComplexity, IntelligenceMode } from "./model-intelligence";
import { classifyTaskComplexity, selectIntelligenceMode, modelsForTask } from "./model-intelligence";

export type RoutingObservation={model:string;latencyMs:number;verificationScore?:number;success?:boolean};
export type AdaptiveRoute={complexity:TaskComplexity;domain:string;mode:IntelligenceMode;models:string[];budgetMs:number;reason:string};

const NUM=(name:string,fallback:number)=>{const n=Number(process.env[name]);return Number.isFinite(n)&&n>0?n:fallback};

export function adaptiveRoute(task:string, observations:RoutingObservation[]=[]):AdaptiveRoute{
  const p=classifyTaskComplexity(task);
  const mode=selectIntelligenceMode(p.complexity,task);
  let models=modelsForTask(p.domain,p.complexity);
  const trusted=observations.filter(o=>o.success!==false&&o.verificationScore==null||Number(o.verificationScore)>=75);
  const avg=new Map<string,{latency:number;score:number;count:number}>();
  for(const o of trusted){
    const v=avg.get(o.model)||{latency:0,score:0,count:0};
    v.latency+=Math.max(1,o.latencyMs); v.score+=o.verificationScore??75; v.count++; avg.set(o.model,v);
  }
  if(avg.size){
    models=[...models].sort((a,b)=>{
      const A=avg.get(a),B=avg.get(b); if(!A&&!B)return 0; if(!A)return 1; if(!B)return -1;
      const sa=A.score/A.count,sb=B.score/B.count,la=A.latency/A.count,lb=B.latency/B.count;
      return (sb-sa)*3+(la-lb)/100;
    });
  }
  const budgetMs=mode==="single"?NUM("CORE_ENGINE_SINGLE_BUDGET_MS",12000):mode==="escalation"?NUM("CORE_ENGINE_ESCALATION_BUDGET_MS",30000):NUM("CORE_ENGINE_CONSENSUS_BUDGET_MS",45000);
  return{complexity:p.complexity,domain:p.domain,mode,models,budgetMs,reason:avg.size?"adaptive:historical verified observations influence ordering":"baseline:insufficient verified observations"};
}

export async function adaptiveModelOrder(models:string[],_domain:string,_complexity:number){return models.slice();}
