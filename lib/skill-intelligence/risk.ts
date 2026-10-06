import type {SkillManifestV2,SkillRisk} from "./contracts";
const weight:Record<SkillRisk,number>={LOW:1,MEDIUM:2,HIGH:3,CRITICAL:4};
export type RiskAssessment={skillId:string;score:number;requiresApproval:boolean;reasons:string[]};
export function assessSkillRisk(skill:SkillManifestV2):RiskAssessment{
 const reasons:string[]=[];
 if(skill.risk==="HIGH"||skill.risk==="CRITICAL")reasons.push("DECLARED_HIGH_RISK");
 if(skill.capabilities.some(c=>c==="WRITE"||c==="EXECUTE"||c==="EXTERNAL"||c==="PUBLISH"))reasons.push("SIDE_EFFECT_CAPABILITY");
 if(skill.trust==="UNVERIFIED")reasons.push("UNVERIFIED_TRUST");
 if(skill.reliability<.8)reasons.push("LOW_RELIABILITY");
 const score=Math.min(1,(weight[skill.risk]/4)+(reasons.length*.08));
 return {skillId:skill.id,score,requiresApproval:score>=.5||skill.trust==="UNVERIFIED",reasons};
}
