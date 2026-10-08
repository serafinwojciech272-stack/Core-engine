export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type EvidenceType = "assessment" | "challenge" | "project" | "production" | "review" | "research";
export type EvidenceStatus = "pending" | "verified" | "rejected" | "expired";
export type AdaptationReason = "assessment" | "evidence" | "decay" | "goal_change" | "research" | "manual";

export interface EvidenceRecord {
  id: string;
  tenantId: string;
  skillId: string;
  type: EvidenceType;
  status: EvidenceStatus;
  score?: number;
  confidence?: number;
  artifactRef?: string;
  evaluator?: string;
  rubricVersion: string;
  submittedAt: string;
  verifiedAt?: string;
  expiresAt?: string;
  feedback?: string;
}

export interface SkillState {
  skillId: string;
  level: MasteryLevel;
  confidence: number;
  evidenceCount: number;
  verifiedEvidenceCount: number;
  lastVerifiedAt?: string;
  nextReviewAt?: string;
}

export interface LearningGoal {
  id: string;
  title: string;
  targetLevel: MasteryLevel;
  priority: number;
  targetDate?: string;
}

export interface LearningAction {
  id: string;
  skillId: string;
  kind: "learn" | "practice" | "build" | "research" | "review" | "ship";
  title: string;
  reason: string;
  estimatedMinutes: number;
  priorityScore: number;
  evidenceRequired: boolean;
}

export interface AssessmentResult {
  attemptId: string;
  skillId: string;
  score: number;
  confidence: number;
  levelBefore: MasteryLevel;
  levelAfter: MasteryLevel;
  gaps: string[];
  recommendedActions: LearningAction[];
  evidenceId: string;
}

export interface AdaptationDecision {
  id: string;
  tenantId: string;
  reason: AdaptationReason;
  selectedSkillIds: string[];
  actions: LearningAction[];
  score: number;
  createdAt: string;
}

export interface SkillNode { id:string; name:string; domain:string; difficulty:number; dependencies:string[]; tags:string[]; }
