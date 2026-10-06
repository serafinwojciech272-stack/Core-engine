import type {SkillManifestV2} from "./contracts";
import {evaluatePostconditions} from "./preconditions";

export type VerificationResult={verified:boolean;blocking:string[];checks:string[]};

export function verifySkillOutcome(skill:SkillManifestV2,output:Record<string,unknown>,facts:Set<string>):VerificationResult {
  const blocking:string[]=[];
  for(const key of skill.outputSchema.required) if(output[key]===undefined) blocking.push("OUTPUT_REQUIRED:"+key);
  const post=evaluatePostconditions(skill,facts);
  blocking.push(...post.missing.map(x=>"POSTCONDITION_MISSING:"+x));
  return {verified:blocking.length===0,blocking,checks:["OUTPUT_SCHEMA","POSTCONDITIONS"]};
}
