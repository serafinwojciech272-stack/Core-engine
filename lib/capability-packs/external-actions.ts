import {registerCapabilityPack} from "@/lib/capability-registry";
import type {CapabilityPack} from "@/lib/capability-contracts";

const externalActionPack: CapabilityPack = {
  id: "external-action-fabric",
  name: "External Action Fabric",
  version: "1.0.0",
  category: "INTEGRATION",
  inspiredBy: ["Core Engine Capability Action Fabric"],
  description: "Explicitly approved outbound actions through a configured external webhook adapter.",
  capabilities: ["external action dispatch","idempotent webhook execution","execution receipts"],
  actions: [{
    id: "external.webhook.dispatch",
    name: "Dispatch external webhook action",
    description: "Send an approved mission action to the configured external action endpoint.",
    risk: "HIGH",
    requiresApproval: true,
    inputs: ["payload"],
    outputs: ["http_status","response_body"]
  }],
  signals: ["external_action_status","external_action_latency"],
  diagnostics: ["adapter_not_configured","adapter_timeout","external_action_failure"],
  metrics: ["external_action_success_rate","external_action_latency"]
};

export function registerExternalActionPack() {
  registerCapabilityPack(externalActionPack);
  return externalActionPack;
}
