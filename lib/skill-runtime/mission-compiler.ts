import type { Mission, MissionState } from "@/lib/engine";
import type { SkillPlan, SkillPlanStep } from "./contracts";

export type CompiledMissionStep = SkillPlanStep & {
  order: number;
  blocking: boolean;
};

export type CompiledMission = {
  objective: string;
  lifecycle: MissionState[];
  entryState: "DISCOVERED";
  approvalState: "AWAITING_APPROVAL";
  executionState: "EXECUTING";
  terminalState: "MEASURING";
  steps: CompiledMissionStep[];
  blocked: boolean;
  blockers: string[];
  requiredArtifacts: SkillPlan["artifacts"];
  successCriteria: SkillPlan["successCriteria"];
};

function topologicalOrder(steps: SkillPlanStep[]) {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const state = new Map<string, 0 | 1 | 2>();
  const ordered: SkillPlanStep[] = [];

  const visit = (id: string) => {
    const current = state.get(id) ?? 0;
    if (current === 1) throw new Error(`SKILL_PLAN_CYCLE:${id}`);
    if (current === 2) return;
    const step = byId.get(id);
    if (!step) throw new Error(`SKILL_PLAN_DEPENDENCY_NOT_FOUND:${id}`);
    state.set(id, 1);
    for (const dependency of step.dependsOn) visit(dependency);
    state.set(id, 2);
    ordered.push(step);
  };

  for (const step of steps) visit(step.id);
  return ordered;
}

export function compileSkillPlanToMission(plan: SkillPlan): CompiledMission {
  const ordered = topologicalOrder(plan.steps);
  const blockers = ordered
    .filter((step) => step.status === "BLOCKED")
    .map((step) => `${step.id}:${step.reason ?? "BLOCKED"}`);

  return {
    objective: plan.objective,
    lifecycle: ["DISCOVERED", "DIAGNOSED", "PROPOSED", "AWAITING_APPROVAL", "APPROVED", "EXECUTING", "MEASURING", "COMPLETED", "LEARNED"],
    entryState: "DISCOVERED",
    approvalState: "AWAITING_APPROVAL",
    executionState: "EXECUTING",
    terminalState: "MEASURING",
    steps: ordered.map((step, order) => ({
      ...step,
      order: order + 1,
      blocking: step.acceptanceCriteria.some((criterion) => criterion.blocking)
    })),
    blocked: blockers.length > 0,
    blockers,
    requiredArtifacts: plan.artifacts,
    successCriteria: plan.successCriteria
  };
}

export function missionFromCompiledPlan(input: { id: string; decisionId: string; kpi: string; plan: CompiledMission; domain?: string }): Mission {
  const now = new Date().toISOString();
  return {
    id: input.id,
    decisionId: input.decisionId,
    objective: input.plan.objective,
    state: input.plan.blocked ? "DISCOVERED" : "DISCOVERED",
    kpi: input.kpi,
    createdAt: now,
    updatedAt: now,
    executionCount: 0,
    domain: input.domain
  };
}
