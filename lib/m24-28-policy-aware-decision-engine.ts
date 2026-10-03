import {
  decideRecovery,
  type RecoveryDecisionEnginePort,
  type RecoveryDecisionResult,
} from "@/lib/recovery-decision-engine";
import type { RecoveryLearningPolicy } from "@/lib/m24-27-learning-policy-contract";
import {
  type PolicyAwareRecoveryDecisionResult,
} from "@/lib/m24-28-policy-aware-decision-contract";

export type RecoveryLearningPolicyReader = {
  read(tenantId: string, recoveryKey: string): Promise<RecoveryLearningPolicy[]>;
};

function rankPolicies(policies: RecoveryLearningPolicy[]): RecoveryLearningPolicy[] {
  return [...policies]
    .filter((policy) => policy.sampleCount > 0)
    .sort((a, b) =>
      b.netWeight - a.netWeight ||
      b.confidenceBps - a.confidenceBps ||
      b.sampleCount - a.sampleCount ||
      a.action.localeCompare(b.action),
    );
}

function policyReason(policy: RecoveryLearningPolicy): string {
  return `Policy favors ${policy.action}: netWeight=${policy.netWeight}, confidenceBps=${policy.confidenceBps}, sampleCount=${policy.sampleCount}.`;
}

function buildResult(
  base: RecoveryDecisionResult,
  decision: RecoveryDecisionResult["decision"],
  policies: RecoveryLearningPolicy[],
  selectedPolicy: RecoveryLearningPolicy | null,
  policyAdjusted: boolean,
  policyReasonText: string,
): PolicyAwareRecoveryDecisionResult {
  const policyCheck = {
    name: "POLICY" as const,
    passed: selectedPolicy !== null,
    reason: policyReasonText,
  };
  return {
    ...base,
    decision,
    reasons: [...base.reasons, policyReasonText],
    checks: [...base.checks, policyCheck],
    requiresApproval: decision !== "NO_ACTION",
    policySource: selectedPolicy ? "LEARNING_POLICY" : "NO_POLICY",
    selectedPolicy,
    candidatePolicies: policies,
    policyAdjusted,
    source: "RECOVERY_STATE + LEARNING_POLICY",
  };
}

export async function evaluatePolicyAwareRecoveryDecision(
  base: RecoveryDecisionResult,
  policies: RecoveryLearningPolicy[],
): Promise<PolicyAwareRecoveryDecisionResult> {
  const ranked = rankPolicies(policies);
  const actionable = ranked.filter(
    (policy) => policy.netWeight >= 0 && policy.confidenceBps >= 5000,
  );
  const best = actionable[0] ?? null;

  if (base.decision === "NO_ACTION") {
    return buildResult(
      base,
      "NO_ACTION",
      ranked,
      best,
      false,
      best ? "Stable policy confirms no recovery action is required." : "No actionable learning policy is available.",
    );
  }

  if (!best) {
    return buildResult(
      base,
      "RECONCILE",
      ranked,
      null,
      base.decision !== "RECONCILE",
      "No learning policy meets the minimum confidence and non-negative weight threshold; reconciliation remains required.",
    );
  }

  const adjusted = base.decision !== best.action;
  return buildResult(
    base,
    best.action,
    ranked,
    best,
    adjusted,
    adjusted
      ? `Policy overrides the state-only recommendation. ${policyReason(best)}`
      : `Policy confirms the state-only recommendation. ${policyReason(best)}`,
  );
}

export class PolicyAwareRecoveryDecisionEngine {
  constructor(
    private readonly policyReader: RecoveryLearningPolicyReader,
    private readonly baseEngine: RecoveryDecisionEnginePort,
  ) {}

  async decide(
    tenantId: string,
    recoveryKey: string,
  ): Promise<PolicyAwareRecoveryDecisionResult | null> {
    const base = await decideRecovery(tenantId, recoveryKey, this.baseEngine);
    if (!base) return null;
    const policies = await this.policyReader.read(tenantId, recoveryKey);
    return evaluatePolicyAwareRecoveryDecision(base, policies);
  }
}

export function createPolicyAwareRecoveryDecisionEngine(): PolicyAwareRecoveryDecisionEngine {
  const { createSupabaseRecoveryLearningPolicyPersistence } = require("@/lib/m24-27-learning-policy-persistence") as typeof import("@/lib/m24-27-learning-policy-persistence");
  const { createSupabaseRecoveryDecisionEngine } = require("@/lib/recovery-decision-engine") as typeof import("@/lib/recovery-decision-engine");
  return new PolicyAwareRecoveryDecisionEngine(
    createSupabaseRecoveryLearningPolicyPersistence(),
    createSupabaseRecoveryDecisionEngine(),
  );
}
