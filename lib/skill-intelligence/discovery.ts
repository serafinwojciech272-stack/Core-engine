import type {SkillManifestV2, SkillMatch} from "./contracts";

function tokens(value:string): string[] {
  return value.toLowerCase().split(/[^a-z0-9ąćęłńóśźż]+/i).filter(Boolean);
}
function text(skill:SkillManifestV2): string {
  return [skill.id,skill.name,skill.description,...skill.domains,...skill.tags].join(" ");
}
export function discoverSkills(query:string, skills:SkillManifestV2[], limit=10): SkillMatch[] {
  const q = new Set(tokens(query));
  if (!q.size) return [];
  return skills.map(skill => {
    const words = new Set(tokens(text(skill)));
    const overlap = [...q].filter(t=>words.has(t));
    const domainHits = skill.domains.filter(d=>q.has(d.toLowerCase())).length;
    const score = Math.min(1, overlap.length/q.size*0.7 + domainHits/q.size*0.3);
    return {skillId:skill.id, score, reasons:overlap.slice(0,6).map(t=>"TERM:"+t)};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,limit));
}
