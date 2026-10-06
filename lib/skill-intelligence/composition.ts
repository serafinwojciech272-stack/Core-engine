import type {SkillComposition, SkillManifestV2} from "./contracts";

export function composeSkills(objective:string, selected:SkillManifestV2[]): SkillComposition {
  const unresolved:string[] = [];
  const edges:Array<{from:string;to:string}> = [];
  const available = new Set(selected.map(s=>s.id));
  for (const skill of selected) {
    for (const dependency of skill.dependencies) {
      if (!available.has(dependency)) unresolved.push(skill.id+"->"+dependency);
      else edges.push({from:dependency,to:skill.id});
    }
  }
  const order = [...selected].sort((a,b)=>a.dependencies.length-b.dependencies.length).map(s=>s.id);
  return {objective:objective.trim(), skillIds:order, edges, unresolved};
}
