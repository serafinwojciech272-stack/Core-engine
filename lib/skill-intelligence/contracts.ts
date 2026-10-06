export type SkillRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SkillCapability = "OBSERVE" | "TRANSFORM" | "WRITE" | "EXECUTE" | "EXTERNAL" | "PUBLISH";
export type SkillContract = {
  id: string;
  version: string;
  name: string;
  description: string;
  domains: string[];
  capabilities: SkillCapability[];
  risk: SkillRisk;
  inputSchema: { required: string[]; properties: Record<string, string> };
  outputSchema: { required: string[]; properties: Record<string, string> };
  preconditions: string[];
  postconditions: string[];
  dependencies: string[];
  tags: string[];
};
export type SkillManifestV2 = SkillContract & {
  manifestVersion: "2.0";
  publisher: string;
  trust: "UNVERIFIED" | "VERIFIED" | "CERTIFIED";
  evidence: string[];
  cost: { latencyMs: number; credits: number };
  reliability: number;
};
export type ContractValidation = { valid: boolean; errors: string[] };
export type SkillMatch = { skillId: string; score: number; reasons: string[] };
export type SkillComposition = { objective: string; skillIds: string[]; edges: Array<{ from: string; to: string }>; unresolved: string[] };
