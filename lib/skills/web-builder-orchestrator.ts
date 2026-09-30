export type WebBuildStage =
  | "DISCOVERY" | "UX" | "ARCHITECTURE" | "IMPLEMENTATION"
  | "TEST" | "BROWSER_QA" | "SECURITY" | "PERFORMANCE" | "DEPLOY" | "LEARN";

export const webBuildStages: WebBuildStage[] = [
  "DISCOVERY","UX","ARCHITECTURE","IMPLEMENTATION","TEST",
  "BROWSER_QA","SECURITY","PERFORMANCE","DEPLOY","LEARN"
];

export type WebBuildPlan = {
  projectId: string;
  stack: string[];
  stages: WebBuildStage[];
  requiresHumanApproval: boolean;
};

export function createWebBuildPlan(projectId: string, stack: string[]): WebBuildPlan {
  if (!projectId) throw new Error("PROJECT_ID_REQUIRED");
  return { projectId, stack: [...new Set(stack)], stages: [...webBuildStages], requiresHumanApproval: true };
}
