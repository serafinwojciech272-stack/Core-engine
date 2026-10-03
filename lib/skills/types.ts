export type SkillRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SkillMode = "OBSERVATIONAL" | "SIMULATION" | "SHADOW" | "LIVE";

export type SkillCapability = {
  id: string;
  description: string;
  riskLevel: SkillRiskLevel;
  modes: SkillMode[];
  requiredTools: string[];
};

export type SkillDefinition = {
  id: string;
  version: string;
  name: string;
  description: string;
  domain: string;
  capabilities: SkillCapability[];
  policies: string[];
  verification: string[];
  learningPolicy: string;
};

export type SkillExecutionContext = {
  tenantId: string;
  missionId?: string;
  mode: SkillMode;
  approvalRequired: boolean;
  correlationId: string;
};
