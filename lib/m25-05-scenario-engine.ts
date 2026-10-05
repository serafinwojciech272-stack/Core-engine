import { createHash } from "node:crypto";
export type Scenario={name:string; probability:number; assumptions:string[]; invalidation:string[]};
export type ScenarioSet={scenarios:Scenario[]; normalized:boolean; scenarioHash:string};
export function buildScenarioSet(input:{names?:string[]; assumptions?:string[]; invalidation?:string[]}):ScenarioSet{
  const names=input.names?.length?input.names:["BASE","UPSIDE","DOWNSIDE"];
  const n=names.length, raw=names.map((name,i)=>({name,probability:1/n,assumptions:[...(input.assumptions??[])],invalidation:[...(input.invalidation??[])]}));
  const scenarios=raw.map(x=>({...x,probability:Math.round(x.probability*10000)/10000}));
  const scenarioHash=createHash("sha256").update(JSON.stringify(scenarios)).digest("hex");
  return {scenarios,normalized:true,scenarioHash};
}
export function validateScenarioSet(set:ScenarioSet):boolean{
  return set.scenarios.length>0 && set.scenarios.every(s=>s.probability>=0&&s.probability<=1) && Math.abs(set.scenarios.reduce((a,s)=>a+s.probability,0)-1)<0.0001;
}
