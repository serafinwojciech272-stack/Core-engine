export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type MasteryDomain =
  | "computer-science"
  | "mathematics"
  | "machine-learning"
  | "deep-learning"
  | "llm-engineering"
  | "agent-engineering"
  | "ai-infrastructure"
  | "ai-product"
  | "ai-research"
  | "ai-business";

export type SkillState = {
  id: string;
  name: string;
  domain: MasteryDomain;
  level: MasteryLevel;
  target: MasteryLevel;
  confidence: number;
  gap: number;
  prerequisites: string[];
  evidenceCount: number;
  lastVerifiedAt: string | null;
  nextAction: string;
};

export type RoadmapStage = {
  id: string;
  year: number;
  quarter: string;
  title: string;
  objective: string;
  skills: string[];
  project: string;
  evidence: string[];
  monetization: string;
  status: "LOCKED" | "READY" | "ACTIVE" | "COMPLETE";
};

export type MasteryProfile = {
  version: string;
  currentLevel: string;
  overall: number;
  target: number;
  domains: Record<string, number>;
  skills: SkillState[];
  strengths: string[];
  gaps: string[];
  blockers: string[];
  updatedAt: string;
};

export type MasteryRoadmap = {
  version: string;
  horizon: "2026-2031";
  generatedAt: string;
  strategy: string;
  stages: RoadmapStage[];
  nextAction: string;
  assumptions: string[];
  changes: string[];
};

export type MasteryEvent = {
  id: string;
  tenantId: string;
  type:
    | "BOOTSTRAP"
    | "ASSESSMENT"
    | "ROADMAP_GENERATED"
    | "DAILY_PLAN"
    | "WEEKLY_REVIEW"
    | "RESEARCH"
    | "PROJECT_EVIDENCE"
    | "SKILL_VERIFIED";
  payload: Record<string, unknown>;
  createdAt: string;
};

export type MasteryAction =
  | "bootstrap"
  | "assess"
  | "roadmap"
  | "daily"
  | "research";
