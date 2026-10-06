import {validateSkillContract} from "./contract-engine";
import type {SkillContract, SkillManifestV2} from "./contracts";

export function toSkillManifestV2(contract: SkillContract, input: Omit<SkillManifestV2,"manifestVersion"|"id"|"version"|"name"|"description"|"domains"|"capabilities"|"risk"|"inputSchema"|"outputSchema"|"preconditions"|"postconditions"|"dependencies"|"tags">): SkillManifestV2 {
  const validation = validateSkillContract(contract);
  if (!validation.valid) throw new Error(validation.errors.join(","));
  if (!input.publisher.trim()) throw new Error("SKILL_PUBLISHER_REQUIRED");
  if (input.reliability < 0 || input.reliability > 1) throw new Error("SKILL_RELIABILITY_INVALID");
  if (input.cost.latencyMs < 0 || input.cost.credits < 0) throw new Error("SKILL_COST_INVALID");
  return {...contract, manifestVersion:"2.0", ...input};
}
