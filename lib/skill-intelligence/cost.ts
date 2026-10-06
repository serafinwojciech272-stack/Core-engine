import type {SkillManifestV2} from "./contracts";
export type SkillCostEstimate={skillId:string;expectedCredits:number;expectedLatencyMs:number;confidence:number};
export function estimateSkillCost(skill:SkillManifestV2,expectedAttempts=1):SkillCostEstimate{
 const attempts=Math.max(1,expectedAttempts);
 return {skillId:skill.id,expectedCredits:skill.cost.credits*attempts,expectedLatencyMs:skill.cost.latencyMs*attempts,confidence:Math.max(0,Math.min(1,skill.reliability))};
}
export function compareSkillCost(a:SkillManifestV2,b:SkillManifestV2):number{
 return (a.cost.credits/Math.max(a.reliability,.01))-(b.cost.credits/Math.max(b.reliability,.01));
}
