import type {SkillAction,SkillAdapter,SkillPack} from "./contracts";
const packs=new Map<string,SkillPack>(); const adapters=new Map<string,SkillAdapter>();
export function validateSkillPack(pack:SkillPack){
 const errors:string[]=[]; if(!pack.id.trim()||!pack.version.trim())errors.push("SKILL_ID_VERSION_REQUIRED"); if(!pack.actions.length)errors.push("SKILL_ACTIONS_REQUIRED");
 const ids=new Set<string>();
 for(const action of pack.actions){
  if(ids.has(action.id))errors.push("DUPLICATE_ACTION:"+action.id); ids.add(action.id);
  if((action.risk==="HIGH"||action.risk==="CRITICAL")&&!action.requiresApproval)errors.push("HIGH_RISK_APPROVAL_REQUIRED:"+action.id);
  if(action.sideEffect!=="NONE"&&!action.requiresIdempotency)errors.push("SIDE_EFFECT_IDEMPOTENCY_REQUIRED:"+action.id);
  if(action.sideEffect!=="NONE"&&!action.permissions.length)errors.push("SIDE_EFFECT_PERMISSION_REQUIRED:"+action.id);
  if(action.retryPolicy.maxAttempts<1||action.retryPolicy.maxAttempts>5)errors.push("RETRY_BUDGET_INVALID:"+action.id);
 }
 return {valid:errors.length===0,errors};
}
export function registerSkillPack(pack:SkillPack){const result=validateSkillPack(pack);if(!result.valid)throw new Error(result.errors.join(","));if(packs.has(pack.id))throw new Error("SKILL_PACK_ALREADY_REGISTERED:"+pack.id);packs.set(pack.id,pack);return pack;}
export function getSkillPack(id:string){return packs.get(id);}
export function listSkillPacks(){return [...packs.values()];}
export function findSkillPacks(query:string){const q=query.toLowerCase().trim();return listSkillPacks().filter(p=>[p.id,p.name,p.description,...p.categories,...p.signals].join(" ").toLowerCase().includes(q));}
export function registerSkillAdapter(adapter:SkillAdapter){if(!adapter.id.trim())throw new Error("SKILL_ADAPTER_ID_REQUIRED");if(adapters.has(adapter.id))throw new Error("SKILL_ADAPTER_ALREADY_REGISTERED:"+adapter.id);adapters.set(adapter.id,adapter);return adapter;}
export function getSkillAdapter(id:string){return adapters.get(id);}
export function listSkillAdapters(){return [...adapters.values()];}
export function clearSkillRuntimeForTests(){packs.clear();adapters.clear();}