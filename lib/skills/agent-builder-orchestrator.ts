export type AgentBuildStage =
  | "GOAL"
  | "CAPABILITIES"
  | "TOOLS"
  | "MODEL"
  | "MEMORY"
  | "POLICIES"
  | "WORKFLOW"
  | "APPROVAL"
  | "EVALUATION"
  | "DEPLOY"
  | "OBSERVE"
  | "LEARN";

export const agentBuildStages: readonly AgentBuildStage[] = [
  "GOAL",
  "CAPABILITIES",
  "TOOLS",
  "MODEL",
  "MEMORY",
  "POLICIES",
  "WORKFLOW",
  "APPROVAL",
  "EVALUATION",
  "DEPLOY",
  "OBSERVE",
  "LEARN",
];

export interface AgentBuildPlan {
  agentId: string;
  capabilities: string[];
  tools: string[];
  stages: readonly AgentBuildStage[];
  requiresHumanApproval: true;
}

export function createAgentBuildPlan(
  agentId: string,
  capabilities: string[],
  tools: string[],
): AgentBuildPlan {
  if (!agentId.trim()) throw new Error("agentId is required");
  return {
    agentId,
    capabilities: [...new Set(capabilities.map((item) => item.trim()).filter(Boolean))],
    tools: [...new Set(tools.map((item) => item.trim()).filter(Boolean))],
    stages: agentBuildStages,
    requiresHumanApproval: true,
  };
}
