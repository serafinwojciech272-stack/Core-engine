export type MasteryLevel=0|1|2|3|4|5;
export type SkillDomain="computer-science"|"mathematics"|"machine-learning"|"deep-learning"|"llm-engineering"|"agent-engineering"|"ai-infrastructure"|"ai-product"|"ai-research"|"ai-business";
export type EvidenceType="assessment"|"challenge"|"project"|"production"|"review"|"research";
export type EvidenceStatus="pending"|"verified"|"rejected"|"expired";
export type AdaptationReason="assessment"|"evidence"|"decay"|"goal_change"|"research"|"manual";
export interface SkillState{ id:string; name:string; domain:SkillDomain; level:MasteryLevel; target:MasteryLevel; confidence:number; gap:number; prerequisites:string[]; evidenceCount:number; lastVerifiedAt:string|null; nextAction:string; skillId?:string; verifiedEvidenceCount?:number; nextReviewAt?:string; }
export interface MasteryProfile{version:string;currentLevel:string;overall:number;target:MasteryLevel;domains:Record<string,number>;skills:SkillState[];strengths:string[];gaps:string[];blockers:string[];updatedAt:string;}
export interface RoadmapStage{id:string;year:number;quarter:string;title:string;objective:string;skills:string[];project:string;evidence:string[];monetization:string;status:string;}
export interface MasteryRoadmap{version:string;horizon:string;generatedAt:string;strategy:string;stages:RoadmapStage[];nextAction:string;assumptions:string[];changes:string[];}
export interface EvidenceRecord{id:string;tenantId:string;skillId:string;type:EvidenceType;status:EvidenceStatus;score?:number;confidence?:number;artifactRef?:string;evaluator?:string;rubricVersion:string;submittedAt:string;verifiedAt?:string;expiresAt?:string;feedback?:string;}
export interface LearningGoal{id:string;title:string;targetLevel:MasteryLevel;priority:number;targetDate?:string;}
export interface LearningAction{id:string;skillId:string;kind:"learn"|"practice"|"build"|"research"|"review"|"ship";title:string;reason:string;estimatedMinutes:number;priorityScore:number;evidenceRequired:boolean;}
export interface AssessmentResult{attemptId:string;skillId:string;score:number;confidence:number;levelBefore:MasteryLevel;levelAfter:MasteryLevel;gaps:string[];recommendedActions:LearningAction[];evidenceId:string;}
export interface AdaptationDecision{id:string;tenantId:string;reason:AdaptationReason;selectedSkillIds:string[];actions:LearningAction[];score:number;createdAt:string;}
export interface SkillNode{id:string;name:string;domain:string;difficulty:number;dependencies:string[];tags:string[];}
export type MasteryAction="bootstrap"|"roadmap"|"assess"|"daily"|"research"|"verify"|"adapt";
