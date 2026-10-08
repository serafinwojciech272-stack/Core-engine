import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { adaptMastery, assessMastery, dailyMaster, generateRoadmap, loadMastery, researchMastery, verifyMasteryEvidence, applyMasteryDecay, setMasteryGoals, createMasteryMission, researchAndAdaptMastery, createProjectLab, updateProjectLab } from "@/lib/mastery-engine/runtime";
import type { MasteryAction, LearningGoal } from "@/lib/mastery-engine/contracts";

export async function GET(request: Request) {
  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = runtime.identity?.tenantId || runtime.legacyTenant?.tenantId;
    if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_NOT_CONFIGURED" }, { status: 401 });
    const state = await loadMastery(tenantId);
    return NextResponse.json({ ok: true, state, identity: runtime.identity ? { tenantId: runtime.identity.tenantId, workspaceId: runtime.identity.workspaceId, role: runtime.identity.role } : null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "MASTERY_READ_FAILED" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "mastery");
  if (guard) return guard;
  try {
    const runtime = await resolveSaaSContext(request);
    const tenantId = runtime.identity?.tenantId || runtime.legacyTenant?.tenantId;
    if (!tenantId) return NextResponse.json({ ok: false, error: "TENANT_NOT_CONFIGURED" }, { status: 401 });
    const body = await request.json() as { action?: MasteryAction; answers?: string; topic?: string; goals?: LearningGoal[]; mission?: { id:string; skillId:string; kind:"learn"|"practice"|"build"|"research"|"review"|"ship"; title:string; reason:string; estimatedMinutes:number; priorityScore:number; evidenceRequired:boolean }; project?: { title:string; objective:string; skills?:string[]; repoUrl?:string; status?:"PLANNED"|"ACTIVE"|"TESTING"|"VERIFIED"|"SHIPPED" }; projectUpdate?: { projectId:string; status?:"PLANNED"|"ACTIVE"|"TESTING"|"VERIFIED"|"SHIPPED"; milestone?:string; evidence?:string }; skillId?: string; evidenceType?: "assessment"|"challenge"|"project"|"production"|"review"|"research"; score?: number; confidence?: number; artifactRef?: string; feedback?: string };
    const action = body.action || "bootstrap";
    if (action === "bootstrap") return NextResponse.json({ ok: true, state: await loadMastery(tenantId) });
    if (action === "roadmap") return NextResponse.json({ ok: true, roadmap: await generateRoadmap(tenantId) });
    if (action === "assess") {
      if (!body.answers?.trim()) return NextResponse.json({ ok: false, error: "ANSWERS_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, profile: await assessMastery(tenantId, body.answers.slice(0, 12000)) });
    }
    if (action === "daily") return NextResponse.json({ ok: true, daily: await dailyMaster(tenantId) });
    if (action === "verify") {
      if (!body.skillId || !body.evidenceType) return NextResponse.json({ ok: false, error: "SKILL_AND_EVIDENCE_TYPE_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, evidence: await verifyMasteryEvidence(tenantId, { skillId: body.skillId, type: body.evidenceType, score: Number(body.score ?? 0), confidence: Number(body.confidence ?? 0), artifactRef: body.artifactRef?.slice(0, 500), feedback: body.feedback?.slice(0, 2000) }) });
    }
    if (action === "adapt") return NextResponse.json({ ok: true, adaptation: await adaptMastery(tenantId) });
    if (action === "decay") return NextResponse.json({ ok: true, profile: await applyMasteryDecay(tenantId) });
    if (action === "goals") {
      if (!Array.isArray(body.goals)) return NextResponse.json({ ok:false, error:"GOALS_REQUIRED" }, { status:400 });
      return NextResponse.json({ ok:true, ...(await setMasteryGoals(tenantId, body.goals)) });
    }
    if (action === "mission") {
      if (!body.mission) return NextResponse.json({ ok:false, error:"MISSION_REQUIRED" }, { status:400 });
      return NextResponse.json({ ok:true, mission: await createMasteryMission(tenantId, body.mission) });
    }
    if (action === "research_adapt") {
      if (!body.topic?.trim()) return NextResponse.json({ ok:false, error:"TOPIC_REQUIRED" }, { status:400 });
      return NextResponse.json({ ok:true, ...(await researchAndAdaptMastery(tenantId, body.topic.slice(0,300))) });
    }
    if (action === "project_update") {
      if (!body.project?.title?.trim()) return NextResponse.json({ ok:false, error:"PROJECT_ID_REQUIRED" }, { status:400 });
      return NextResponse.json({ ok:true, project: await updateProjectLab(tenantId, { projectId: body.project.title, status: body.project.status, milestone: body.project.objective, evidence: body.project.repoUrl }) });
    }
    if (action === "project") {
      if (!body.project?.title?.trim() || !body.project.objective?.trim()) return NextResponse.json({ ok:false, error:"PROJECT_TITLE_AND_OBJECTIVE_REQUIRED" }, { status:400 });
      return NextResponse.json({ ok:true, project: await createProjectLab(tenantId, body.project) });
    }
    if (action === "research") {
      if (!body.topic?.trim()) return NextResponse.json({ ok: false, error: "TOPIC_REQUIRED" }, { status: 400 });
      return NextResponse.json({ ok: true, research: await researchMastery(tenantId, body.topic.slice(0, 300)) });
    }
    return NextResponse.json({ ok: false, error: "UNKNOWN_MASTERY_ACTION" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "MASTERY_OPERATION_FAILED" }, { status: 503 });
  }
}
