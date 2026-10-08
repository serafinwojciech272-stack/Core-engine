import { modelRegistry, modelsForDomain } from "@/lib/m11-model-registry";
import type { ModelProfile } from "@/lib/m11-model-registry";

export type TaskComplexity = 1|2|3|4|5|6|7|8|9|10;
export type IntelligenceMode = "single"|"escalation"|"consensus";
export type { ModelProfile };

function env(name:string){return process.env[name]?.trim()||"";}

export function classifyTaskComplexity(task:string){
  const t=task.toLowerCase();
  const reasons:string[]=[];
  let score=2;
  let domain="general";
  if(/(kod|repo|bug|debug|architektur|implement|refaktor|api|typescript|javascript)/.test(t)){score+=2;domain="coding";reasons.push("technical");}
  if(/(strateg|biznes|finans|trading|inwest|ryzyko|praw|medycz|high.?stakes)/.test(t)){score+=3;domain="high-stakes";reasons.push("high-stakes");}
  if(/(research|zbadaj|konkurenc|rynek|źródła|sources|porównaj)/.test(t)){score+=2;domain="research";reasons.push("research");}
  if(/(plik|pdf|xlsx|csv|dokument|obraz|video|multimodal)/.test(t)){score+=1;reasons.push("multimodal");}
  if(/(wielu|multi|porównaj.*modele|consensus|zweryfikuj.*niezależnie)/.test(t)){score+=2;reasons.push("multi-agent");}
  if(t.length>1600){score+=1;reasons.push("long-context");}
  score=Math.max(1,Math.min(10,score));
  return {complexity:score as TaskComplexity,domain,reasons};
}

export function selectIntelligenceMode(complexity:TaskComplexity,task:string):IntelligenceMode{
  const forced=env("CORE_ENGINE_INTELLIGENCE_MODE").toLowerCase();
  if(["single","escalation","consensus"].includes(forced))return forced as IntelligenceMode;
  if(complexity>=9||/(^|\\s)(consensus|multi.?model|second opinion|second opinions)(\\s|$)/i.test(task))return "consensus";
  if(complexity>=6)return "escalation";
  return "single";
}

export { modelRegistry };

export function modelsForTask(domain:string,complexity:number){
  return modelsForDomain(domain,complexity);
}

export function intelligenceReadiness(){
  const models=modelRegistry();
  return {
    mAI01:"READY",
    mAI02:"READY",
    mAI03:"READY",
    modelRegistry:"READY",
    models,
    routing:{
      mode:"task-aware",
      override:"CORE_ENGINE_INTELLIGENCE_MODE",
      consensus:"complexity>=9 or explicit consensus",
      escalation:"complexity>=6"
    }
  };
}
