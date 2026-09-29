import {listSkillPacks,getSkillAdapter} from "./registry";
import type {SkillPlan,SkillPlanStep} from "./contracts";
const terms:Record<string,string[]>={android:["android","kotlin","compose","mobile","aplikację android","aplikacja android","mobilną","mobilna"],ux:["ux","ui","accessibility","wcag","user flow","journey","interfejs","dostępność","nawigac"],security:["security","bezpieczeń","threat","privacy","qa","quality","release","test","audit","ryzyko"],proposal:["proposal","ofert","enterprise","roi","pricing","klient","zarząd","scope"],research:["research","badanie","rynek","konkurenc","evidence","źródła","sources"]};
export function planSkills(input:{objective:string;locale?:string;executionMode?:SkillPlan["executionMode"]}):SkillPlan{
 const objective=input.objective.trim(),q=objective.toLowerCase();
 const matched=new Set<string>();
 for(const [key,values] of Object.entries(terms))if(values.some(t=>q.includes(t)))matched.add(key);
 const selected=listSkillPacks().filter(p=>p.categories.some(c=>matched.has(c.toLowerCase())||[p.id,p.name,p.description,...p.signals].join(" ").toLowerCase().includes(c.toLowerCase())&&matched.size>0));
 const steps:SkillPlanStep[]=[];const missing=new Set<string>();
 for(const pack of selected)for(const action of pack.actions){const adapter=getSkillAdapter(action.adapterId);if(!adapter)missing.add(action.adapterId);steps.push({id:pack.id+":"+action.id,skillId:pack.id,actionId:action.id,adapterId:action.adapterId,risk:action.risk,permissions:action.permissions,sideEffect:action.sideEffect,requiresApproval:action.requiresApproval,requiresIdempotency:action.requiresIdempotency,retryPolicy:action.retryPolicy,status:adapter?"PLANNED":"BLOCKED",reason:adapter?undefined:"PLAN_ONLY_UNTIL_ADAPTERS_REGISTERED"});}
 return {runtime:"skill-runtime-v2",executionMode:input.executionMode??"PLAN_ONLY",objective,locale:input.locale??"en-US",steps,selectedSkills:selected.map(x=>x.id),missingAdapters:[...missing]};
}