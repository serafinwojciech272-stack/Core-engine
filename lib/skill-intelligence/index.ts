export type SkillManifestV2={id:string;version:string;name:string;description:string;domains:string[];risk:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL";capabilities:string[];inputSchema:Record<string,unknown>;publisher?:string;trust:"VERIFIED"|"UNVERIFIED";reliability:number;cost:{credits:number;latencyMs:number}};
export type SkillRiskAssessment={risk:SkillManifestV2["risk"];requiresApproval:boolean;reasons:string[]};
export function assessSkillRisk(skill:SkillManifestV2):SkillRiskAssessment {
 const reasons:string[]=[];
 if(skill.risk==="HIGH"||skill.risk==="CRITICAL") reasons.push("HIGH_RISK");
 if(skill.capabilities.some(c=>/write|delete|external|execute/i.test(c))) reasons.push("SIDE_EFFECT_CAPABILITY");
 if(skill.trust==="UNVERIFIED") reasons.push("UNVERIFIED_TRUST");
 if(skill.reliability<0.8) reasons.push("LOW_RELIABILITY");
 return {risk:skill.risk,requiresApproval:skill.risk==="CRITICAL"||reasons.length>0,reasons};
}
