import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { composeAgent } from "@/lib/skills/agent-composition";
import { runAgentControl } from "@/lib/agent-control-plane";
import { decideAgentApproval, persistAgentComposition, storageMode } from "@/lib/storage";
import { enforcePersistentAgentExecution } from "@/lib/skills/agent-execution-enforcement";
import { authenticate } from "@/lib/auth";
import type { EngineSignal } from "@/lib/engine";

const MAX = 16000;

export async function POST(request: Request) {
  const guard = guardMutation(request, "agent-control");
  if (guard) return guard;

  try {
    const runtime = await resolveSaaSContext(request);
    const tenant = runtime.identity ? { tenantId: runtime.identity.tenantId } : runtime.legacyTenant;
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX) return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    const tenantId = String(body.tenantId || tenant?.tenantId || "");
    if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_ID_REQUIRED" }, { status: 400 });
    const action = String(body.action || "compose");

    if ((action === "approve" || action === "reject") && storageMode() === "supabase") {
      const compositionId = String(body.compositionId || "");
      const reason = String(body.reason || "").trim();
      const actorId = runtime.identity?.userId || authenticate(request, true).id;
      if (!compositionId || !reason) return NextResponse.json({ ok: false, error: "COMPOSITION_ID_AND_REASON_REQUIRED" }, { status: 400 });
      const decision = await decideAgentApproval(compositionId, action === "approve" ? "APPROVED" : "REJECTED", actorId, reason);
      return NextResponse.json({ ok: true, version: "M12.2", approval: decision, persistent: true });
    }

    if (action === "authorize") {
      const compositionId = String(body.compositionId || "");
      const missionId = String(body.missionId || "");
      const capabilityId = String(body.capability || "");
      const correlationId = String(body.correlationId || "");
      if (!compositionId || !missionId || !capabilityId || !correlationId) return NextResponse.json({ ok: false, error: "AUTHORIZATION_CONTEXT_REQUIRED" }, { status: 400 });
      const authorization = await enforcePersistentAgentExecution({ compositionId, tenantId, missionId, capabilityId, correlationId });
      return NextResponse.json({ ok: authorization.allowed, version: "M12.2", authorization, executionPermission: authorization.allowed }, { status: authorization.allowed ? 200 : 403 });
    }

    const signals = Array.isArray(body.signals)
      ? body.signals.filter((value): value is EngineSignal => Boolean(value) && typeof value === "object" && typeof (value as EngineSignal).name === "string" && typeof (value as EngineSignal).value === "string" && typeof (value as EngineSignal).source === "string")
      : [];
    const requestedCapability = String(body.capability || "");
    const domain = String(body.domain || "business");
    const mode = String(body.mode || "OBSERVATIONAL") as import("@/lib/skills/types").SkillMode;
    const approved = body.approved === true;
    const killSwitchActive = body.killSwitchActive === true;
    const composition = composeAgent({ tenantId, signals, domain, capability: requestedCapability, mode, approved, killSwitchActive, missionId: typeof body.missionId === "string" ? body.missionId : undefined });
    const control = await runAgentControl({ signals, domain, requestedCapability: composition.capability, actor: { id: "agent-control", kind: "system" } });

    let persistence: Record<string, unknown> = { persistent: false, reason: "SUPABASE_NOT_CONFIGURED" };
    if (storageMode() === "supabase") {
      const persisted = await persistAgentComposition({
        tenantId, agentId: composition.agentId, skillId: composition.skill.id, skillVersion: composition.skill.version,
        capabilityId: composition.capability, mode: composition.mode,
        correlationId: `agent:${tenantId}:${composition.missionBinding?.missionId ?? "composition"}:${composition.capability}:${composition.compositionId}`,
        missionId: composition.missionBinding?.missionId, composition: composition as unknown as Record<string, unknown>, approvalScope: composition.approval.scope,
      });
      persistence = { persistent: true, ...persisted };
    }

    return NextResponse.json({ ok: true, version: "M12.2", composition, control, persistence, executionPermission: false, executionGate: "PERSISTENT_APPROVAL_AUTHORIZATION_REQUIRED" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AGENT_CONTROL_FAILED";
    const status = code.startsWith("NO_COMPATIBLE_") ? 422 : 503;
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}
