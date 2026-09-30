import type { SkillDefinition } from "./types";

const registry = new Map<string, SkillDefinition>();

export function registerSkill(skill: SkillDefinition): void {
  if (!skill.id || !skill.version) throw new Error("INVALID_SKILL_DEFINITION");
  if (registry.has(skill.id)) throw new Error(`SKILL_ALREADY_REGISTERED:${skill.id}`);
  registry.set(skill.id, skill);
}

export function getSkill(id: string): SkillDefinition | null {
  return registry.get(id) ?? null;
}

export function listSkills(): SkillDefinition[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function clearSkillRegistryForTests(): void {
  registry.clear();
}
