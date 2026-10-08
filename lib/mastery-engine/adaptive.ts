import { randomUUID } from "crypto";
import type { AdaptationDecision, LearningAction, LearningGoal, SkillState, SkillNode, MasteryLevel } from "./contracts";

function levelValue(level: MasteryLevel | undefined) {
  return typeof level === "number" ? level : 0;
}

function dependencyReady(skill: SkillNode, states: Map<string, SkillState>) {
  return skill.dependencies.every(id => levelValue(states.get(id)?.level) >= 3);
}

export function adaptLearning(input:{tenantId:string;skills:SkillNode[];states:SkillState[];goals:LearningGoal[];now?:Date;reason?:AdaptationDecision["reason"]}):AdaptationDecision {
  const now=input.now||new Date();
  const stateById=new Map(input.states.map(s=>[s.skillId || s.id,s]));
  const goalById=new Map(input.goals.map(g=>[g.id,g]));
  const ranked=input.skills.map(skill=>{
    const state=stateById.get(skill.id);
    const level=levelValue(state?.level);
    const confidence=Math.max(0,Math.min(1,state?.confidence ?? 0));
    const goal=goalById.get(skill.id);
    const gap=1-level/5;
    const uncertainty=1-confidence;
    const urgency=goal?.targetDate
      ? Math.max(0,Math.min(1,1-(new Date(goal.targetDate).getTime()-now.getTime())/(180*86400000)))
      : .2;
    const blocked=!dependencyReady(skill,stateById) && skill.dependencies.length>0;
    const priorityScore=gap*.55+uncertainty*.25+urgency*.2;
    return {skill,state,level,priorityScore,blocked};
  }).filter(x=>!x.blocked).sort((a,b)=>b.priorityScore-a.priorityScore);

  const actions:LearningAction[]=ranked.slice(0,6).map(({skill,state,level,priorityScore})=>{
    const kind:LearningAction["kind"]=level<2?"learn":level<3?"practice":level<4?"build":level<5?"ship":"research";
    const title=kind==="learn"?"Learn "+skill.name:kind==="practice"?"Practice "+skill.name:kind==="build"?"Build with "+skill.name:kind==="ship"?"Ship production evidence for "+skill.name:"Research frontier "+skill.name;
    return {id:randomUUID(),skillId:skill.id,kind,title,reason:"Gap "+Math.round((1-level/5)*100)+"%, confidence "+Math.round((state?.confidence ?? 0)*100)+"%, urgency weighted.",estimatedMinutes:kind==="learn"?45:kind==="practice"?45:kind==="build"?60:kind==="ship"?90:30,priorityScore,evidenceRequired:true};
  });

  const score=actions.reduce((sum,a)=>sum+a.priorityScore,0)/Math.max(1,actions.length);
  return {id:randomUUID(),tenantId:input.tenantId,reason:input.reason || "assessment",selectedSkillIds:actions.map(a=>a.skillId),actions,score,createdAt:now.toISOString()};
}