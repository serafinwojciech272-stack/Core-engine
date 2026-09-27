import type { CapabilityPack } from "@/lib/capability-contracts";
import { registerCapabilityPack } from "@/lib/capability-registry";

const integrationsPack: CapabilityPack = {
  id: "integrations", name: "External Integrations", version: "1.0.0", category: "INTEGRATIONS",
  inspiredBy: ["Webhook APIs"],
  description: "Controlled external HTTP execution behind approval, allowlisting, timeout and idempotency boundaries.",
  capabilities: ["webhook dispatch", "external API execution", "integration receipts"],
  actions: [{ id: "integration.webhook.dispatch", name: "Dispatch approved webhook", description: "Send a signed, bounded HTTP request to an explicitly allowlisted external integration.", risk: "HIGH", requiresApproval: true, inputs: ["url", "method", "payload"], outputs: ["http_status", "response_sample", "request_id"] }],
  signals: ["http_status", "latency", "integration_success"],
  diagnostics: ["integration_failure", "timeout", "blocked_target"],
  metrics: ["integration_success_rate", "integration_latency"]
};

export function registerIntegrationCapabilityPack() { registerCapabilityPack(integrationsPack); return integrationsPack; }
