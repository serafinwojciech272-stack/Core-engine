import { registerSkill, listSkills } from "./registry";
import { agentBuilderSkill } from "./agent-builder";
import { forexTradingSkill } from "./trading-forex";
import { webBuilderSkill } from "./web-builder";

let initialized = false;

export function initializeCoreSkills(): void {
  if (initialized) return;
  for (const skill of [agentBuilderSkill, forexTradingSkill, webBuilderSkill]) registerSkill(skill);
  initialized = true;
}

export function getCoreSkills() {
  initializeCoreSkills();
  return listSkills();
}

export { getSkill, listSkills, registerSkill } from "./registry";
export type { SkillCapability, SkillDefinition, SkillExecutionContext, SkillMode, SkillRiskLevel } from "./types";
