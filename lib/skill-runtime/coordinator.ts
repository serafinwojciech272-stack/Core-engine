import type { CompiledMission } from "./mission-compiler";
import { executeSkillAction } from "./executor";
import type { SkillExecutionResult, SkillExecutionMode } from "./contracts";

export type MissionExecutionStep = {
  stepId: string;
  status: SkillExecutionResult["status"] | "SKIPPED" | "BLOCKED_DEPENDENCY";
  result?: SkillExecutionResult;
  producedArtifactIds: string[];
  reason?: string;
};

export type MissionExecutionReport = {
  mode: SkillExecutionMode;
  missionId: string;
  status: "PLAN_ONLY" | "COMPLETED" | "BLOCKED" | "FAILED" | "AWAITING_APPROVAL";
  steps: MissionExecutionStep[];
  artifacts: string[];
  blockers: string[];
  criteriaPending: string[];
};

export async function executeCompiledMission(input: {
  missionId: string;
  mission: CompiledMission;
  mode?: SkillExecutionMode;
  approved: boolean;
  permissions: Parameters<typeof executeSkillAction>[0]["permissions"];
  tenantId?: string;
  workspaceRoot?: string;
  payloadByStep?: Record<string, Record<string, unknown>>;
  verifiedCriteria?: string[];
}): Promise<MissionExecutionReport> {
  const mode = input.mode ?? "PLAN_ONLY";
  const steps: MissionExecutionStep[] = [];
  const completed = new Set<string>();
  const artifacts = new Set<string>();
  const blockers = [...input.mission.blockers];
  const verifiedCriteria = new Set(input.verifiedCriteria ?? []);
  const blockingCriteria = input.mission.successCriteria.filter((criterion) => criterion.blocking);
  const pendingCriteria = () => blockingCriteria.filter((criterion) => !verifiedCriteria.has(criterion.id)).map((criterion) => criterion.id);

  if (mode === "PLAN_ONLY" || input.mission.blocked) {
    return {
      mode,
      missionId: input.missionId,
      status: input.mission.blocked ? "BLOCKED" : "PLAN_ONLY",
      steps: input.mission.steps.map((step) => ({
        stepId: step.id,
        status: step.status === "BLOCKED" ? "BLOCKED" : "PLANNED",
        producedArtifactIds: step.produces.map((artifact) => artifact.id),
        reason: step.reason
      })),
      artifacts: input.mission.requiredArtifacts.map((artifact) => artifact.id),
      blockers,
      criteriaPending: pendingCriteria()
    };
  }

  if (!input.approved && input.mission.steps.some((step) => step.requiresApproval)) {
    return {
      mode,
      missionId: input.missionId,
      status: "AWAITING_APPROVAL",
      steps: [],
      artifacts: [],
      blockers: ["MISSION_APPROVAL_REQUIRED"],
      criteriaPending: pendingCriteria()
    };
  }

  for (const step of input.mission.steps) {
    const failedDependency = step.dependsOn.find((dependency) => !completed.has(dependency));
    if (failedDependency) {
      const item: MissionExecutionStep = { stepId: step.id, status: "BLOCKED_DEPENDENCY", producedArtifactIds: [], reason: `DEPENDENCY_NOT_COMPLETED:${failedDependency}` };
      steps.push(item);
      blockers.push(item.reason!);
      continue;
    }

    if (step.status === "BLOCKED") {
      const item: MissionExecutionStep = { stepId: step.id, status: "BLOCKED", producedArtifactIds: [], reason: step.reason };
      steps.push(item);
      blockers.push(`${step.id}:${step.reason ?? "BLOCKED"}`);
      continue;
    }

    const idempotencyKey = `${input.missionId}:${step.id}`;
    const result = await executeSkillAction({
      skillId: step.skillId,
      actionId: step.actionId,
      missionId: input.missionId,
      tenantId: input.tenantId,
      permissions: input.permissions,
      approved: input.approved,
      idempotencyKey: step.requiresIdempotency ? idempotencyKey : undefined,
      payload: input.payloadByStep?.[step.id],
      workspaceRoot: input.workspaceRoot
    });
    const produced = result.status === "EXECUTED" ? step.produces.map((artifact) => artifact.id) : [];
    produced.forEach((id) => artifacts.add(id));
    steps.push({ stepId: step.id, status: result.status, result, producedArtifactIds: produced, reason: result.status === "EXECUTED" ? undefined : result.message });
    if (result.status === "EXECUTED") completed.add(step.id);
    else {
      blockers.push(`${step.id}:${result.message}`);
      if (step.blocking) {
        for (const downstream of input.mission.steps.filter((candidate) => candidate.dependsOn.includes(step.id))) {
          steps.push({ stepId: downstream.id, status: "BLOCKED_DEPENDENCY", producedArtifactIds: [], reason: `BLOCKED_BY:${step.id}` });
          blockers.push(`${downstream.id}:BLOCKED_BY:${step.id}`);
        }
        break;
      }
    }
  }

  const criteriaPending = pendingCriteria();
  const status = blockers.length ? "BLOCKED" : steps.some((step) => step.status === "FAILED") ? "FAILED" : criteriaPending.length ? "BLOCKED" : "COMPLETED";
  return { mode, missionId: input.missionId, status, steps, artifacts: [...artifacts], blockers, criteriaPending };
}
