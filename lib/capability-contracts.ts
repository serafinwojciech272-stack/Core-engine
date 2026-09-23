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
