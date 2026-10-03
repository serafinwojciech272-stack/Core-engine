import type { EngineSignal, Mission } from "@/lib/engine";
import { getCoreSkills, initializeCoreSkills } from "./index";
import { evaluateExecutionRequest, type ExecutionDecision } from "./execution-plane";
import type { SkillDefinition, SkillMode } from "./types";

export type AgentCompositionRequest = {
  signals: EngineSignal[];
  domain?: string;
  capability?: string;
  mode?: SkillMode;
  tenantId: string;
  missionId?: string;
  approved?: boolean;
  killSwitchActive?: boolean;
};

export type AgentPlanStep = {
  stage: "INTENT" | "CAPABILITY" | "POLICY" | "RISK" | "APPROVAL" | "EXECUTION" | "VERIFICATION" | "MEMORY" | "LEARNING";
  action: string;
  required: boolean;
};

export type AgentComposition = {
  compositionId: string;
  agentId: string;
  version: "M12.0";
  skill: { id: string; version: string; domain: string };
  capability: string;
  mode: SkillMode;
  approval: { required: boolean; approved: boolean; scope: string[] };
  execution: ExecutionDecision;
  plan: AgentPlanStep[];
  missionBinding?: { missionId: string };
  learningBoundary: { eligible: false; reason: string };
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function scoreSkill(skill: SkillDefinition, domain: string, capability: string): number {
  const d = normalize(domain);
  const c = normalize(capability);
  let score = 0;
  if (d && normalize(skill.domain) === d) score += 5;
  if (d && normalize(skill.id).includes(d)) score += 3;
  if (c && skill.capabilities.some(x => normalize(x.id) === c)) score += 10;
  if (c && skill.capabilities.some(x => normalize(x.id).includes(c))) score += 4;
  return score;
}

function selectSkill(skills: SkillDefinition[], domain: string, capability: string): SkillDefinition {
  const ranked = skills
    .map(skill => ({ skill, score: scoreSkill(skill, domain, capability) }))
    .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id));

  if (!ranked.length || ranked[0].score === 0) throw new Error("NO_COMPATIBLE_SKILL");
  return ranked[0].skill;
}

function selectCapability(skill: SkillDefinition, requested: string): string {
  const exact = skill.capabilities.find(c => normalize(c.id) === normalize(requested));
  if (exact) return exact.id;
  const partial = skill.capabilities.find(c => normalize(c.id).includes(normalize(requested)));
  if (partial) return partial.id;
  if (skill.capabilities.length === 1) return skill.capabilities[0].id;
  throw new Error("NO_COMPATIBLE_CAPABILITY");
}

function planFor(execution: ExecutionDecision, approvalRequired: boolean): AgentPlanStep[] {
  return [
    { stage: "INTENT", action: "normalize request and bind tenant context", required: true },
    { stage: "CAPABILITY", action: "resolve versioned skill and capability contract", required: true },
    { stage: "POLICY", action: "evaluate policy and required tools", required: true },
    { stage: "RISK", action: "evaluate capability risk and optional account limits", required: execution.stage === "RISK" || execution.allowed },
    { stage: "APPROVAL", action: approvalRequired ? "await explicit human approval" : "record approval decision", required: approvalRequired },
    { stage: "EXECUTION", action: execution.allowed ? "execute only the approved capability scope" : "do not execute", required: true },
    { stage: "VERIFICATION", action: "verify correlation, output contract, evidence and state", required: true },
    { stage: "MEMORY", action: "persist verified execution evidence", required: true },
    { stage: "LEARNING", action: "defer learning until verified outcome exists", required: true },
  ];
}

export function composeAgent(request: AgentCompositionRequest): AgentComposition {
  if (!request.tenantId.trim()) throw new Error("TENANT_ID_REQUIRED");
  initializeCoreSkills();

  const domain = request.domain?.trim() || "business";
  const requestedCapability = request.capability?.trim() || "";
  const mode = request.mode ?? "OBSERVATIONAL";
  const skill = selectSkill(getCoreSkills(), domain, requestedCapability);
  const capability = selectCapability(skill, requestedCapability);

  const execution = evaluateExecutionRequest({
    skill,
    capabilityId: capability,
    context: {
      tenantId: request.tenantId,
      missionId: request.missionId,
      mode,
      approvalRequired: request.approved !== true,
      correlationId: `agent:${request.tenantId}:${request.missionId ?? "composition"}:${capability}`,
    },
    approved: request.approved === true,
    killSwitchActive: request.killSwitchActive ?? false,
  });

  const capabilityDef = skill.capabilities.find(c => c.id === capability)!;
  const approvalRequired = capabilityDef.riskLevel === "HIGH" || capabilityDef.riskLevel === "CRITICAL" || request.approved !== true;

  return {
    compositionId: crypto.randomUUID(),
    agentId: `core-agent:${skill.id}`,
    version: "M12.0",
    skill: { id: skill.id, version: skill.version, domain: skill.domain },
    capability,
    mode,
    approval: {
      required: approvalRequired,
      approved: request.approved === true,
      scope: [skill.id, capability, "execution"],
    },
    execution,
    plan: planFor(execution, approvalRequired),
    missionBinding: request.missionId ? { missionId: request.missionId } : undefined,
    learningBoundary: {
      eligible: false,
      reason: "M12 composition may plan and authorize boundaries; learning requires verified outcome in the existing learning loop",
    },
  };
}

export function composeAgentForMission(
  mission: Mission,
  request: Omit<AgentCompositionRequest, "missionId" | "tenantId"> & { tenantId: string },
): AgentComposition {
  return composeAgent({
    ...request,
    missionId: mission.id,
    domain: request.domain ?? mission.domain ?? "business",
  });
}
