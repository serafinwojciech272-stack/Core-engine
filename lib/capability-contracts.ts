export const CAPABILITY_CONTRACT_VERSION = "capability-v1" as const;

export type CapabilityCategory =
  | "SEO" | "CONTENT" | "PAGES" | "FORMS" | "ANALYTICS" | "ECOMMERCE"
  | "SECURITY" | "PERFORMANCE" | "BACKUP" | "INTEGRATION" | "EMAIL"
  | "ANTI_SPAM" | "MEDIA" | "DATA" | "REDIRECTS" | "LOCALIZATION"
  | "MONITORING" | "SOCIAL";

export type CapabilityRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CapabilityAction = {
  id: string;
  name: string;
  description: string;
  risk: CapabilityRisk;
  requiresApproval: boolean;
  inputs: string[];
  outputs: string[];
};

// M8.4 execution semantics. These are the explicit, deterministic states a
// capability execution may report. They extend the existing Mission state
// machine; they are not a second state machine.
export const CAPABILITY_EXECUTION_STATUSES = [
  "EXECUTING", "EXECUTED", "APPROVAL_REQUIRED", "ADAPTER_NOT_FOUND",
  "NOT_FOUND", "FAILED", "RETRYABLE", "BLOCKED", "IDEMPOTENCY_CONFLICT"
] as const;
export type CapabilityExecutionStatus = typeof CAPABILITY_EXECUTION_STATUSES[number];

export const CAPABILITY_FAILURE_CATEGORIES = [
  "CAPABILITY_NOT_FOUND", "APPROVAL_REQUIRED", "ADAPTER_NOT_FOUND",
  "EXECUTION_FAILED", "EXECUTION_TIMEOUT", "EXECUTION_BLOCKED", "IDEMPOTENCY_CONFLICT"
] as const;
export type CapabilityFailureCategory = typeof CAPABILITY_FAILURE_CATEGORIES[number];

export type CapabilitySideEffectStatus = "NONE" | "APPLIED" | "UNKNOWN";

export type CapabilityExecutionError = {
  category: CapabilityFailureCategory;
  message: string;
  retryable: boolean;
};

// Deterministic retry policy: only transient execution faults may be retried
// automatically. Structural faults (no adapter, no approval, blocked, bad
// idempotency) must never be retried without human intervention.
const RETRYABLE_CATEGORIES: readonly CapabilityFailureCategory[] = ["EXECUTION_TIMEOUT", "EXECUTION_FAILED"];
export function isRetryableFailureCategory(category: CapabilityFailureCategory) {
  return RETRYABLE_CATEGORIES.includes(category);
}

export type CapabilityPack = {
  id: string;
  name: string;
  version: string;
  category: CapabilityCategory;
  inspiredBy: string[];
  description: string;
  capabilities: string[];
  actions: CapabilityAction[];
  signals: string[];
  diagnostics: string[];
  metrics: string[];
  dependencies?: string[];
};

export function validateCapabilityPack(pack: CapabilityPack) {
  const errors: string[] = [];
  if (!pack.id.trim()) errors.push("CAPABILITY_ID_REQUIRED");
  if (!pack.name.trim()) errors.push("CAPABILITY_NAME_REQUIRED");
  if (!pack.version.trim()) errors.push("CAPABILITY_VERSION_REQUIRED");
  if (!pack.capabilities.length) errors.push("CAPABILITIES_REQUIRED");
  if (!pack.actions.length) errors.push("ACTIONS_REQUIRED");
  for (const action of pack.actions) {
    if (!action.id || !action.name) errors.push("ACTION_INVALID");
    if (action.risk === "HIGH" || action.risk === "CRITICAL") {
      if (!action.requiresApproval) errors.push("HIGH_RISK_APPROVAL_REQUIRED:" + action.id);
    }
  }
  return { valid: errors.length === 0, errors };
}
