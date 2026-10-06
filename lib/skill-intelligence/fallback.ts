import type {SkillManifestV2} from "./contracts";
export type FallbackGraph={primary:string;alternatives:string[];blocked:string[]};
export function buildFallbackGraph(primary:SkillManifestV2,candidates:SkillManifestV2[]):FallbackGraph{
 const blocked:string[]=[]; const alternatives:string[]=[];
 for(const candidate of candidates){
  if(candidate.id===primary.id)continue;
  if(candidate.risk=== "CRITICAL" && primary.risk!=="CRITICAL"){blocked.push(candidate.id);continue;}
  const compatible=candidate.domains.some(d=>primary.domains.includes(d)) && candidate.capabilities.some(c=>primary.capabilities.includes(c));
  if(compatible)alternatives.push(candidate.id); else blocked.push(candidate.id);
 }
 return {primary:primary.id,alternatives,blocked};
}
