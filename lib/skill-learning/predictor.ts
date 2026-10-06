import type {SkillManifestV2} from "../skill-intelligence";
import type {SkillPerformance,SkillPrediction} from "./contracts";
export function predictSkill(skill:SkillManifestV2,performance?:SkillPerformance):SkillPrediction{
 const p=performance;
 const success=p ? Math.max(0,Math.min(1,p.successRate)) : Math.max(0,Math.min(1,skill.reliability));
 return {skillId:skill.id,successProbability:success,expectedLatencyMs:p?.avgLatencyMs||skill.cost.latencyMs,expectedCredits:p?.avgCredits||skill.cost.credits,confidence:p?Math.max(.2,p.confidence):.2};
}