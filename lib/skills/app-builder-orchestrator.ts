export type AppBuildStage =
  | "PRODUCT_SPEC"
  | "ARCHITECTURE"
  | "DATA_MODEL"
  | "API_CONTRACT"
  | "AUTH"
  | "FRONTEND"
  | "BACKEND"
  | "TEST"
  | "SECURITY"
  | "E2E"
  | "DEPLOY"
  | "OBSERVE"
  | "LEARN";

export const appBuildStages: readonly AppBuildStage[] = [
  "PRODUCT_SPEC",
  "ARCHITECTURE",
  "DATA_MODEL",
  "API_CONTRACT",
  "AUTH",
  "FRONTEND",
  "BACKEND",
  "TEST",
  "SECURITY",
  "E2E",
  "DEPLOY",
  "OBSERVE",
  "LEARN",
];

export interface AppBuildPlan {
  projectId: string;
  stack: string[];
  stages: readonly AppBuildStage[];
  requiresHumanApproval: true;
}

export function createAppBuildPlan(projectId: string, stack: string[]): AppBuildPlan {
  if (!projectId.trim()) throw new Error("projectId is required");
  return {
    projectId,
    stack: [...new Set(stack.map((item) => item.trim()).filter(Boolean))],
    stages: appBuildStages,
    requiresHumanApproval: true,
  };
}
