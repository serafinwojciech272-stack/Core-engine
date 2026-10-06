import type {SkillManifestV2} from "./contracts";

export type ConditionResult={satisfied:boolean;missing:string[]};

export function evaluatePreconditions(skill:SkillManifestV2,facts:Set<string>):ConditionResult {
  const missing=skill.preconditions.filter(condition=>!facts.has(condition));
  return {satisfied:missing.length===0,missing};
}
export function evaluatePostconditions(skill:SkillManifestV2,facts:Set<string>):ConditionResult {
  const missing=skill.postconditions.filter(condition=>!facts.has(condition));
  return {satisfied:missing.length===0,missing};
}
