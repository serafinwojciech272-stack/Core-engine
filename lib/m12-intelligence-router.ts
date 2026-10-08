import { classifyTaskComplexity, selectIntelligenceMode, modelsForTask, type TaskComplexity, type IntelligenceMode } from "@/lib/model-intelligence";

export type IntelligenceRoute = {
  complexity: TaskComplexity;
  domain: string;
  reasons: string[];
  mode: IntelligenceMode;
  candidateModels: string[];
  primaryModel: string | null;
  fallbackModels: string[];
  consensusModels: string[];
  judgeModel: string | null;
};

export function routeIntelligenceTask(task: string): IntelligenceRoute {
  const classification = classifyTaskComplexity(task);
  const mode = selectIntelligenceMode(classification.complexity, task);
  const candidateModels = modelsForTask(classification.domain, classification.complexity);
  const primaryModel = candidateModels[0] ?? null;
  const fallbackModels = candidateModels.slice(1);
  const consensusModels = mode === "consensus" ? candidateModels.slice(0, 2) : [];
  const judgeModel = mode === "consensus" ? (candidateModels[2] ?? candidateModels[1] ?? null) : null;

  return {
    complexity: classification.complexity,
    domain: classification.domain,
    reasons: classification.reasons,
    mode,
    candidateModels,
    primaryModel,
    fallbackModels,
    consensusModels,
    judgeModel
  };
}

export function intelligenceRouterReadiness() {
  return {
    status: "READY",
    version: "M12",
    routing: ["single", "escalation", "consensus"],
    registryBacked: true,
    credentialMaterialExposed: false
  };
}
