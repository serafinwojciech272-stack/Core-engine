import { registerSkill, listSkills, getSkill } from "./registry";
import { agentBuilderSkill } from "./agent-builder";
import { forexTradingSkill } from "./trading-forex";
import { webBuilderSkill } from "./web-builder";
import { initializeCoreTools } from "./tool-registry-init";

let initialized = false;

export function initializeCoreSkills(): void {
  const coreSkillIds = ["trading.forex", "web.fullstack-builder", "agent.builder"];
  const registryHealthy = coreSkillIds.every((id) => Boolean(getSkill(id)));
  if (initialized && registryHealthy) return;

  initializeCoreTools();
  for (const skill of [agentBuilderSkill, forexTradingSkill, webBuilderSkill]) {
    if (!getSkill(skill.id)) registerSkill(skill);
  }
  initialized = true;
}

export function getCoreSkills() {
  initializeCoreSkills();
  return listSkills();
}

export { getSkill, listSkills, registerSkill } from "./registry";
export { getTool, listTools, registerTool } from "./tool-registry";
export { evaluateExecutionRequest, executionPlaneStages } from "./execution-plane";
export { evaluatePolicy } from "./policy-engine";
export { createPlannerOutput, runExecutionLifecycle } from "./execution-lifecycle";
export { syncExecutionToCoreEngine } from "./core-engine-bridge";
export { assertGovernedMissionPhase, canEnterGovernedMissionPhase, requiredMissionStateForPhase } from "./mission-state-gate";
export { executeSkillMissionCapability, completeSkillMissionMeasurement } from "./mission-execution-bridge";
export type { CoreEngineExecutionBridgeInput, CoreEngineExecutionBridgeResult } from "./core-engine-bridge";
export type { SkillMissionExecutionInput, SkillMissionExecutionResult, SkillMissionMeasurementInput, SkillMissionMeasurementResult } from "./mission-execution-bridge";
export type { ExecutionLifecycleResult, ExecutionLifecycleRequest, PlannerOutput, ApprovalObject, ExecutionResult, VerificationResult, MemoryEvent, LearningEvent, ExecutionLifecycleState } from "./execution-lifecycle";
export type {
  SkillCapability,
  SkillDefinition,
  SkillExecutionContext,
  SkillMode,
  SkillRiskLevel,
} from "./types";
