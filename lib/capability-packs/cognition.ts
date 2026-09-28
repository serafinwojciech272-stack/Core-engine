import type { CapabilityPack } from "@/lib/capability-contracts";
import { registerCapabilityPack } from "@/lib/capability-registry";

const cognitionPack: CapabilityPack = {
  id: "cognition",
  name: "Core Engine Cognition",
  version: "1.0.0",
  category: "DATA",
  inspiredBy: ["LLM synthesis"],
  description: "Provider-agnostic language synthesis behind the existing capability approval boundary.",
  capabilities: ["understand", "decide-language-synthesis", "learning-draft"],
  actions: [{
    id: "cognition.llm.synthesize",
    name: "Run approved cognition synthesis",
    description: "Generate bounded language synthesis using the configured server-side LLM provider.",
    risk: "HIGH",
    requiresApproval: true,
    inputs: ["operation", "tenant_id", "mission_id", "payload"],
    outputs: ["content", "model", "latency_ms", "token_usage"],
  }],
  signals: ["llm_summary", "llm_diagnosis", "llm_recommendation", "lesson_draft"],
  diagnostics: ["llm_not_configured", "llm_failure", "llm_audit_failure"],
  metrics: ["llm_latency", "llm_token_usage", "llm_success_rate"],
};

export function registerCognitionCapabilityPack() {
  registerCapabilityPack(cognitionPack);
  return cognitionPack;
}
