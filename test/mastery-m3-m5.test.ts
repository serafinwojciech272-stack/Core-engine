import { describe, expect, it } from "vitest";
import { adaptLearning } from "../lib/mastery-engine/adaptive";
import { scoreToLevel, recomputeSkillState } from "../lib/mastery-engine/evidence";
import { createMasteryMission, createProjectLab, loadMastery } from "../lib/mastery-engine/runtime";

describe("AI Mastery M3-M5", () => {
  it("M3 maps evidence to mastery and adaptive action", () => {
    expect(scoreToLevel(.92)).toBe(5);
    const base = loadMastery;
    expect(base).toBeTypeOf("function");
    const state = recomputeSkillState({
      id:"python",name:"Python",domain:"computer-science",level:0,target:5,confidence:0,gap:5,
      prerequisites:[],evidenceCount:0,lastVerifiedAt:null,nextAction:"Baseline assessment"
    }, [{id:"e1",tenantId:"t",skillId:"python",type:"assessment",status:"verified",score:.8,confidence:.9,rubricVersion:"v1",submittedAt:new Date().toISOString(),verifiedAt:new Date().toISOString()}]);
    expect(state.level).toBe(4);
    const decision=adaptLearning({tenantId:"t",skills:[{id:"python",name:"Python",domain:"computer-science",difficulty:2,dependencies:[],tags:[]}],states:[state],goals:[{id:"python",title:"Python",targetLevel:5,priority:5}]});
    expect(decision.actions[0].skillId).toBe("python");
    expect(decision.actions[0].kind).toBe("ship");
  });

  it("M4 creates an executable mastery mission from a skill action", async () => {
    const state=await loadMastery("m3-m4-test");
    const mission=await createMasteryMission("m3-m4-test",{id:"a",skillId:state.profile.skills[0].id,kind:"learn",title:"Learn "+state.profile.skills[0].name,reason:"gap",estimatedMinutes:45,priorityScore:1,evidenceRequired:true});
    expect(mission.steps).toContain("Verify");
    expect(mission.evidenceRequired).toBe(true);
  });

  it("M5 creates a project lab with milestone gates", async () => {
    const state=await loadMastery("m5-test");
    const project=await createProjectLab("m5-test",{title:"AI Mastery Capstone",objective:"Ship an evidence-backed AI system",skills:[state.profile.skills[0].id]});
    expect(project.status).toBe("PLANNED");
    expect(project.milestones).toEqual(["Define","Build MVP","Test","Verify evidence","Ship"]);
  });
});
