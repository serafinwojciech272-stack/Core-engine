import type {SkillManifestV2} from "./contracts";

export type SkillGraph = {nodes:string[]; edges:Array<{from:string;to:string}>; cycles:string[][]; unresolved:string[]};

export function buildSkillDependencyGraph(skills:SkillManifestV2[]): SkillGraph {
  const ids=new Set(skills.map(s=>s.id));
  const edges:Array<{from:string;to:string}>=[], unresolved:string[]=[];
  for(const skill of skills) for(const dependency of skill.dependencies) {
    if(ids.has(dependency)) edges.push({from:dependency,to:skill.id}); else unresolved.push(skill.id+"->"+dependency);
  }
  const adjacency=new Map<string,string[]>();
  for(const id of ids) adjacency.set(id,[]);
  for(const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  const visiting=new Set<string>(), visited=new Set<string>(), cycles:string[][]=[];
  const dfs=(id:string,path:string[])=>{
    if(visiting.has(id)){const i=path.indexOf(id);cycles.push([...path.slice(i),id]);return;}
    if(visited.has(id))return;
    visiting.add(id);
    for(const next of adjacency.get(id)??[]) dfs(next,[...path,id]);
    visiting.delete(id);visited.add(id);
  };
  for(const id of ids) dfs(id,[]);
  return {nodes:[...ids],edges,cycles,unresolved};
}
