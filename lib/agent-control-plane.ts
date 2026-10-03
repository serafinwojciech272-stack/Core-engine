import { buildDecision } from "@/lib/ai-decision";
import { buildContextEvidence } from "@/lib/context-evidence-runtime";
import { buildAuditChain } from "@/lib/audit-chain";
import type { EvidenceInput } from "@/lib/evidence-engine";
import type { EngineSignal, Mission } from "@/lib/engine";

export type AgentStage =
  | "INTENT"
  | "CAPABILITY_MATCH"
  | "POLICY_GATE"
  | "RISK_ASSESSMENT"
  | "APPROVAL_OBJECT"
  | "EXECUTION_PLAN"
  | "VERIFICATION_PLAN"
  | "MEMORY_EVENT"
  | "LEARNING_EVENT"
  | "AUDIT_COMMIT";

export type AgentControlRequest = {
  signals: EngineSignal[];
  domain?: string;
  requestedCapability?: string;
  actor?: { id: string; kind: "human" | "system" };
  evidence?: EvidenceInput[];
  mission?: Mission;
};

export type AgentControlResult = {
  ok: true;
  agent: "core-agent";
  version: "M12-M15";
  intent: { domain: string; capability: string; rationale: string };
  policy: { status: "ALLOW" | "APPROVAL_REQUIRED" | "BLOCK"; reasons: string[] };
  risk: { level: "LOW" | "MEDIUM" | "HIGH"; score: number; reasons: string[] };
  approval: { required: boolean; status: "NOT_REQUIRED" | "PENDING"; actorType: "human" | "system"; scope: string[] };
  executionPlan: { mode: "DRY_RUN" | "GOVERNED"; steps: string[] };
  verificationPlan: { required: true; checks: string[] };
  memoryEvent: { type: "AGENT_CONTROL_DECISION"; key: string; payload: Record<string, unknown> };
  learningEvent: { type: "AGENT_LEARNING_BOUNDARY"; eligible: false; reason: string };
  audit: { integrity: string; chainLength: number; head?: string };
};

function capabilityFor(domain: string, requested?: string) {
  return requested?.trim() || `${domain}:decision-mission`;
}

function riskFor(decision: Awaited<ReturnType<typeof buildDecision>>) {
  const reasons: string[] = [];
  if (decision.riskGate === "BLOCK") return { level: "HIGH" as const, score: 1, reasons: ["Core decision risk gate returned BLOCK"] };
  if (decision.confidence < 0.55) reasons.push("decision confidence below governed threshold");
  if (decision.signalConflict?.status === "DETECTED") reasons.push("signal conflict detected");
  if (decision.priority === "HIGH") reasons.push("high priority mission");
  if (reasons.length >= 2) return { level: "HIGH" as const, score: 0.8, reasons };
  if (reasons.length === 1) return { level: "MEDIUM" as const, score: 0.5, reasons };
  return { level: "LOW" as const, score: 0.15, reasons: ["no elevated risk signals"] };
}

export async function runAgentControl(request: AgentControlRequest): Promise<AgentControlResult> {
  const domain = request.domain?.trim().slice(0, 40) || "business";
  const capability = capabilityFor(domain, request.requestedCapability);
  const evidence = request.evidence ?? request.signals.map((s) => ({ claim: `${s.name} = ${s.value}`, source: s.source }));
  const context = buildContextEvidence({ signals: request.signals, evidence, domain });
  const decision = await buildDecision(request.signals, domain, [], undefined);
  const risk = riskFor(decision);
  const policyStatus = decision.riskGate === "BLOCK" ? "BLOCK" : risk.level === "HIGH" ? "APPROVAL_REQUIRED" : "ALLOW";
  const approvalRequired = policyStatus !== "ALLOW" || request.actor?.kind !== "system";
  const policyReasons = policyStatus === "BLOCK" ? ["risk gate blocked execution"] : approvalRequired ? ["human approval boundary enforced before execution"] : ["policy permits governed execution"];
  const trace = [
    "INTENT", "CAPABILITY_MATCH", "POLICY_GATE", "RISK_ASSESSMENT", "APPROVAL_OBJECT",
    "EXECUTION_PLAN", "VERIFICATION_PLAN", "MEMORY_EVENT", "LEARNING_EVENT", "AUDIT_COMMIT"
  ];
  const auditMission = request.mission ?? ({ id: crypto.randomUUID(), objective: `Agent control: ${capability}`, state: "AWAITING_APPROVAL", kpi: "governance_integrity" } as Mission);
  const chain = await buildAuditChain({ signals: request.signals, decision, mission: auditMission, trace });
  return {
    ok: true,
    agent: "core-agent",
    version: "M12-M15",
    intent: { domain, capability, rationale: `Mapped request to ${capability} through Core Engine decision intelligence` },
    policy: { status: policyStatus, reasons: policyReasons },
    risk,
    approval: { required: approvalRequired, status: approvalRequired ? "PENDING" : "NOT_REQUIRED", actorType: "human", scope: [capability, "execution", "external-side-effects"] },
    executionPlan: { mode: approvalRequired ? "DRY_RUN" : "GOVERNED", steps: ["validate capability contract", "apply policy", "execute only approved scope", "persist execution result"] },
    verificationPlan: { required: true, checks: ["correlation integrity", "state transition integrity", "output contract", "audit chain integrity", `evidence_quality=${context.evidenceQuality.score}`] },
    memoryEvent: { type: "AGENT_CONTROL_DECISION", key: `${domain}:${capability}`, payload: { confidence: decision.confidence, priority: decision.priority, evidenceCount: context.evidence.length } },
    learningEvent: { type: "AGENT_LEARNING_BOUNDARY", eligible: false, reason: "Learning activates only after verified execution outcome" },
    audit: { integrity: process.env.AUDIT_SIGNING_KEY ? "SIGNED" : "UNSIGNED", chainLength: chain.length, head: chain.at(-1)?.hash }
  };
}
