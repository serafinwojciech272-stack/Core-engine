export const CORE_CONTRACT_VERSION = "core-contracts-v1" as const;

export type DomainId = string;

export type Signal = {
  id?: string;
  name: string;
  value: string | number | boolean | null;
  source: string;
  observedAt?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export type Context = {
  domain: DomainId;
  subjectId?: string;
  objective?: string;
  constraints?: string[];
  signals: Signal[];
  metadata?: Record<string, unknown>;
};

export type Evidence = {
  id: string;
  claim: string;
  source: string;
  observedAt?: string;
  freshness?: number;
  reliability?: number;
  supports?: boolean;
  metadata?: Record<string, unknown>;
};

export type Diagnosis = {
  summary: string;
  findings: string[];
  evidenceIds: string[];
  confidence: number;
  assumptions: string[];
};

export type DecisionOption = {
  id: string;
  action: string;
  rationale: string;
  expectedImpact?: number;
  risk?: number;
  effort?: number;
  evidenceIds: string[];
};

export type DecisionContract = {
  id: string;
  domain: DomainId;
  diagnosis: Diagnosis;
  options: DecisionOption[];
  recommendation: string;
  confidence: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assumptions: string[];
  evidenceIds: string[];
  reasoningSource: "LLM" | "DETERMINISTIC_RULES";
};

export type MissionContract = {
  id: string;
  decisionId: string;
  domain: DomainId;
  objective: string;
  kpi: string;
  state: string;
  requiredApproval: boolean;
};

export type DomainPack = {
  id: DomainId;
  version: string;
  description: string;
  signals: string[];
  diagnose: (context: Context, evidence: Evidence[]) => Promise<Diagnosis> | Diagnosis;
  decide?: (context: Context, diagnosis: Diagnosis, evidence: Evidence[]) => Promise<DecisionContract> | DecisionContract;
  buildMission?: (decision: DecisionContract) => Promise<MissionContract> | MissionContract;
};

export function validateConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function validateCoreContract(contract: DecisionContract) {
  const errors: string[] = [];
  if (!contract.id) errors.push("DECISION_ID_REQUIRED");
  if (!contract.domain) errors.push("DOMAIN_REQUIRED");
  if (!contract.diagnosis.summary) errors.push("DIAGNOSIS_REQUIRED");
  if (!contract.recommendation) errors.push("RECOMMENDATION_REQUIRED");
  if (!contract.evidenceIds.length) errors.push("EVIDENCE_REQUIRED");
  if (!Number.isFinite(contract.confidence) || contract.confidence < 0 || contract.confidence > 1) errors.push("CONFIDENCE_INVALID");
  return { valid: errors.length === 0, errors };
}
