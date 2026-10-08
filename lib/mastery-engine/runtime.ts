import { randomUUID } from "node:crypto";
import { seedMasteryProfile, seedMasteryRoadmap } from "./seed";
import type { MasteryProfile, MasteryRoadmap, EvidenceRecord, LearningGoal, SkillNode, SkillState, AdaptationDecision, LearningActionInput } from "./contracts";
import { verifyEvidence, recomputeSkillState } from "./evidence";
import { adaptLearning } from "./adaptive";

function cfg() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  return url && key ? { url, key } : null;
}

async function db(path: string, init: RequestInit = {}) {
  const c = cfg();
  if (!c) return null;
  const response = await fetch(c.url + path, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: c.key,
      Authorization: "Bearer " + c.key,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!response.ok) throw new Error("MASTERY_DB_" + response.status);
  return response.json();
}

const mem = globalThis as typeof globalThis & {
  __mastery?: Map<string, { profile: MasteryProfile; roadmap: MasteryRoadmap }>;
  __masteryEvidence?: Map<string, EvidenceRecord[]>;
};
mem.__mastery ??= new Map();
mem.__masteryEvidence ??= new Map();

export async function loadMastery(tenantId: string) {
  const local = mem.__mastery?.get(tenantId);
  if (local) return local;
  const c = cfg();
  if (!c) {
    const seeded = { profile: seedMasteryProfile(), roadmap: seedMasteryRoadmap() };
    mem.__mastery!.set(tenantId, seeded);
    return seeded;
  }
  const url = new URL(c.url + "/rest/v1/ce_intelligence_runs");
  url.searchParams.set("tenant_id", "eq." + tenantId);
  url.searchParams.set("state", "in.(MASTERY_PROFILE,MASTERY_ROADMAP)");
  url.searchParams.set("select", "state,payload,created_at");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "50");
  const rows = await db(url.pathname + url.search);
  let profile: MasteryProfile | null = null;
  let roadmap: MasteryRoadmap | null = null;
  for (const row of (rows || []) as Array<{state:string;payload:Record<string,unknown>}>){
    if (!profile && row.state === "MASTERY_PROFILE") profile = row.payload as unknown as MasteryProfile;
    if (!roadmap && row.state === "MASTERY_ROADMAP") roadmap = row.payload as unknown as MasteryRoadmap;
  }
  const value = { profile: profile || seedMasteryProfile(), roadmap: roadmap || seedMasteryRoadmap() };
  mem.__mastery!.set(tenantId, value);
  return value;
}

async function persist(tenantId: string, state: "MASTERY_PROFILE" | "MASTERY_ROADMAP" | "MASTERY_EVIDENCE" | "MASTERY_ADAPTATION" | "MASTERY_MISSION" | "MASTERY_PROJECT", payload: Record<string, unknown>) {
  const row = {
    tenant_id: tenantId,
    request_id: "mastery-" + randomUUID(),
    engine_version: "MASTERY-v1",
    state,
    run_hash: randomUUID().replaceAll("-", ""),
    payload
  };
  await db("/rest/v1/ce_intelligence_runs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row)
  });
}

async function openRouterRequest(task: string, context: string, options: { structured?: boolean; web?: boolean; timeoutMs?: number } = {}) {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) return null;
  const model = (process.env.OPENROUTER_MASTERY_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-5-mini").trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 45000);
  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: "You are AI Master Agent inside Core Engine. Be evidence-based. Never claim a skill, project or outcome is verified without evidence. Return only the requested output." },
        { role: "user", content: task + "\n\nCONTEXT:\n" + context.slice(0, 60000) }
      ],
      temperature: 0.15,
      provider: { require_parameters: Boolean(options.structured) }
    };
    if (options.structured) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "mastery_output",
          strict: true,
          schema: {
            type: "object",
            properties: { result: { type: "string" } },
            required: ["result"],
            additionalProperties: false
          }
        }
      };
    }
    if (options.web) {
      body.tools = [{ type: "openrouter:web_search" }, { type: "openrouter:web_fetch" }];
    }
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://core-engine-34uu.onrender.com",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "AI Mastery Engine"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const raw = await response.json() as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> };
    const value = raw.choices?.[0]?.message?.content;
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(x => x.text || "").join("").trim();
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function aiJson(task: string, context: string) {
  const text = await openRouterRequest(task, context, { structured: true, timeoutMs: 45000 });
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { result?: string };
    if (typeof parsed.result === "string") return JSON.parse(parsed.result) as Record<string, unknown>;
    return parsed as unknown as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\\s\\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { return null; }
  }
}

export async function generateRoadmap(tenantId: string, goal = "Become an expert AI builder and monetize the capability") {
  const current = await loadMastery(tenantId);
  const context = JSON.stringify({ profile: current.profile, roadmap: current.roadmap });
  const output = await aiJson(
    "Act as the AI Master Agent. Improve the user's 2026-2031 AI mastery roadmap. Return strict JSON with keys strategy, nextAction, assumptions, changes, and stages. Each stage must have id, year, quarter, title, objective, skills, project, evidence, monetization, status. Preserve evidence-based progression. Do not invent completed skills.",
    context
  );
  if (!output) return current.roadmap;
  const roadmap: MasteryRoadmap = {
    ...current.roadmap,
    version: "ROADMAP v1." + (Number(current.roadmap.version.match(/\d+$/)?.[0] || 0) + 1),
    generatedAt: new Date().toISOString(),
    strategy: typeof output.strategy === "string" ? output.strategy : current.roadmap.strategy,
    nextAction: typeof output.nextAction === "string" ? output.nextAction : current.roadmap.nextAction,
    assumptions: Array.isArray(output.assumptions) ? output.assumptions.map(String) : current.roadmap.assumptions,
    changes: Array.isArray(output.changes) ? output.changes.map(String) : ["Adaptive roadmap refresh"],
    stages: Array.isArray(output.stages) ? output.stages as MasteryRoadmap["stages"] : current.roadmap.stages
  };
  mem.__mastery!.set(tenantId, { profile: current.profile, roadmap });
  if (cfg()) await persist(tenantId, "MASTERY_ROADMAP", roadmap as unknown as Record<string, unknown>);
  return roadmap;
}

export async function assessMastery(tenantId: string, answers: string) {
  const current = await loadMastery(tenantId);
  const output = await aiJson(
    "Assess the user's AI mastery. Return JSON with keys overall, currentLevel, domains, strengths, gaps, blockers and skills. Skills must contain id, level 0-5, target 5, confidence 0-1, gap, evidenceCount, lastVerifiedAt and nextAction. Treat self-report as provisional evidence and do not claim verification.",
    JSON.stringify({ answers, baseline: current.profile })
  );
  if (!output) return current.profile;
  const profile: MasteryProfile = {
    ...current.profile,
    version: "PROFILE v1.1",
    updatedAt: new Date().toISOString(),
    currentLevel: typeof output.currentLevel === "string" ? output.currentLevel : current.profile.currentLevel,
    overall: Number(output.overall ?? current.profile.overall),
    domains: (output.domains as Record<string, number>) || current.profile.domains,
    strengths: Array.isArray(output.strengths) ? output.strengths.map(String) : current.profile.strengths,
    gaps: Array.isArray(output.gaps) ? output.gaps.map(String) : current.profile.gaps,
    blockers: Array.isArray(output.blockers) ? output.blockers.map(String) : current.profile.blockers,
    skills: Array.isArray(output.skills) ? output.skills as MasteryProfile["skills"] : current.profile.skills
  };
  mem.__mastery!.set(tenantId, { profile, roadmap: current.roadmap });
  if (cfg()) await persist(tenantId, "MASTERY_PROFILE", profile as unknown as Record<string, unknown>);
  return profile;
}

export async function dailyMaster(tenantId: string) {
  const current = await loadMastery(tenantId);
  const output = await aiJson(
    "Create today's AI Master plan. Return JSON with keys objective, learning, building, coreEngine, research, assessment, business, expectedResult. Keep it focused on one primary objective and use the user's current gaps.",
    JSON.stringify(current)
  );
  return output || {
    objective: current.roadmap.nextAction,
    learning: ["30 minutes of focused study"],
    building: ["Implement the smallest working exercise"],
    coreEngine: ["Map the exercise to an existing Core Engine capability"],
    research: ["Read one primary source"],
    assessment: ["Write a short explanation and verify it with a test"],
    business: ["Identify one real use case"],
    expectedResult: "One verified learning artifact"
  };
}

export async function researchMastery(tenantId: string, topic: string) {
  const current = await loadMastery(tenantId);
  const result = await openRouterRequest(
    "Research current developments relevant to AI mastery for this topic. Use web search and web fetch when useful. Prefer primary sources. Separate facts, implications, uncertainty, source quality and recommended roadmap changes. Do not treat marketing claims as facts.",
    JSON.stringify({ topic, profile: current.profile, roadmap: current.roadmap }),
    { web: true, timeoutMs: 60000 }
  );
  return {
    topic,
    result: result || "Research unavailable",
    routing: { provider: "openrouter", model: process.env.OPENROUTER_MASTERY_MODEL || process.env.OPENROUTER_MODEL || "configured-model", tools: ["web_search", "web_fetch"] },
    requestId: "mastery-" + randomUUID()
  };
}


async function loadEvidence(tenantId: string, skillId?: string): Promise<EvidenceRecord[]> {
  const cached = mem.__masteryEvidence?.get(tenantId) || [];
  if (!cfg()) return skillId ? cached.filter(e => e.skillId === skillId) : cached;
  const c0 = cfg()!;
  const url = new URL(c0.url + "/rest/v1/ce_intelligence_runs");
  url.searchParams.set("tenant_id", "eq." + tenantId);
  url.searchParams.set("state", "eq.MASTERY_EVIDENCE");
  url.searchParams.set("select", "payload,created_at");
  url.searchParams.set("order", "created_at.asc");
  url.searchParams.set("limit", "500");
  const rows = await db(url.pathname + url.search) as Array<{payload: Record<string, unknown>}>;
  const all = (rows || []).map(row => row.payload as unknown as EvidenceRecord).filter(e => Boolean(e?.id && e?.skillId));
  mem.__masteryEvidence!.set(tenantId, all);
  return skillId ? all.filter(e => e.skillId === skillId) : all;
}

export async function verifyMasteryEvidence(tenantId:string,input:{skillId:string;type:EvidenceRecord["type"];score:number;confidence:number;artifactRef?:string;feedback?:string}) {
  const current=await loadMastery(tenantId);
  const skill=current.profile.skills.find(s=>s.id===input.skillId);
  if(!skill) throw new Error("MASTERY_SKILL_NOT_FOUND");
  if(!Number.isFinite(input.score) || input.score < 0 || input.score > 1) throw new Error("MASTERY_INVALID_SCORE");
  if(!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) throw new Error("MASTERY_INVALID_CONFIDENCE");

  const evidence=verifyEvidence({
    tenantId,
    skillId:input.skillId,
    type:input.type,
    rubricVersion:"evidence-v1",
    submittedAt:new Date().toISOString(),
    score:input.score,
    confidence:input.confidence,
    artifactRef:input.artifactRef,
    feedback:input.feedback
  });

  const history=await loadEvidence(tenantId,input.skillId);
  const allEvidence=[...history,evidence];
  mem.__masteryEvidence!.set(tenantId,[...(mem.__masteryEvidence?.get(tenantId) || []),evidence]);
  const next=recomputeSkillState(skill,allEvidence);
  const profile={
    ...current.profile,
    skills:current.profile.skills.map(s=>s.id===input.skillId
      ? {...s,...next,gap:Math.max(0,next.target-next.level),nextAction:next.level>=4?"Build production evidence":"Complete next verification"}
      : s),
    updatedAt:new Date().toISOString()
  };
  mem.__mastery!.set(tenantId,{profile,roadmap:current.roadmap});
  if(cfg()) {
    await persist(tenantId,"MASTERY_EVIDENCE",evidence as unknown as Record<string,unknown>);
    await persist(tenantId,"MASTERY_PROFILE",profile as unknown as Record<string,unknown>);
  }
  return evidence;
}

export async function applyMasteryDecay(tenantId:string, now=new Date()) {
  const current=await loadMastery(tenantId);
  const profile={...current.profile,skills:current.profile.skills.map(skill=>{
    const last=skill.lastVerifiedAt ? new Date(skill.lastVerifiedAt).getTime() : 0;
    const ageDays=last ? Math.max(0,(now.getTime()-last)/86400000) : 9999;
    const decay=ageDays>180 ? 0.5 : ageDays>90 ? 0.25 : ageDays>30 ? 0.1 : 0;
    const confidence=Math.max(0,Math.min(1,skill.confidence-decay));
    return {...skill,confidence,nextReviewAt:new Date(now.getTime()+Math.max(7,Math.min(90,Math.round(30+ageDays/3)))*86400000).toISOString()};
  }),updatedAt:now.toISOString()};
  mem.__mastery!.set(tenantId,{profile,roadmap:current.roadmap});
  if(cfg()) await persist(tenantId,"MASTERY_PROFILE",profile as unknown as Record<string,unknown>);
  return profile;
}

export async function setMasteryGoals(tenantId:string, goals:LearningGoal[]) {
  const current=await loadMastery(tenantId);
  const normalized=goals.slice(0,20).map(g=>({...g,priority:Math.max(1,Math.min(10,g.priority))}));
  const roadmap={...current.roadmap,changes:[...current.roadmap.changes,"Goals updated"],nextAction:normalized[0]?.title||current.roadmap.nextAction,generatedAt:new Date().toISOString()};
  mem.__mastery!.set(tenantId,{profile:current.profile,roadmap});
  if(cfg()) await persist(tenantId,"MASTERY_ROADMAP",roadmap as unknown as Record<string,unknown>);
  return {goals:normalized,roadmap};
}

export async function createMasteryMission(tenantId:string, action:import("./contracts").LearningAction) {
  const current=await loadMastery(tenantId);
  const skill=current.profile.skills.find(s=>s.id===action.skillId);
  if(!skill) throw new Error("MASTERY_SKILL_NOT_FOUND");
  return {
    id:"mission-"+randomUUID(),tenantId,skillId:action.skillId,kind:action.kind,title:action.title,
    objective:action.title,steps:["Learn","Build","Test","Submit evidence","Verify","Update mastery"],
    evidenceRequired:true,status:"READY",createdAt:new Date().toISOString()
  };
}

export async function researchAndAdaptMastery(tenantId:string,topic:string) {
  const research=await researchMastery(tenantId,topic);
  const current=await loadMastery(tenantId);
  const adaptation=await adaptMastery(tenantId,"research");
  if(cfg()) await persist(tenantId,"MASTERY_ADAPTATION",{...adaptation,researchTopic:topic,researchRequestId:research.requestId} as unknown as Record<string,unknown>);
  return {research,adaptation,current};
}

export async function createProjectLab(tenantId:string,input:{title:string;objective:string;skills?:string[];repoUrl?:string}) {
  const current=await loadMastery(tenantId);
  const skills=(input.skills||[]).filter(id=>current.profile.skills.some(s=>s.id===id)).slice(0,12);
  const project={id:"project-"+randomUUID(),tenantId,title:input.title.slice(0,200),objective:input.objective.slice(0,1000),skills,repoUrl:input.repoUrl?.slice(0,500),status:"PLANNED",milestones:["Define","Build MVP","Test","Verify evidence","Ship"],evidence:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(cfg()) await persist(tenantId,"MASTERY_PROJECT",project as unknown as Record<string,unknown>);
  return project;
}

export async function updateProjectLab(tenantId:string,input:{projectId:string;status?:"PLANNED"|"ACTIVE"|"TESTING"|"VERIFIED"|"SHIPPED";milestone?:string;evidence?:string}) {
  const project={id:input.projectId,tenantId,status:input.status||"ACTIVE",milestone:input.milestone||null,evidence:input.evidence||null,updatedAt:new Date().toISOString()};
  if(cfg()) await persist(tenantId,"MASTERY_PROJECT",project as unknown as Record<string,unknown>);
  return project;
}

export async function adaptMastery(tenantId:string,reason:AdaptationDecision["reason"]="evidence"):Promise<AdaptationDecision>{
  const current=await loadMastery(tenantId);
  const skills:SkillNode[]=current.profile.skills.map(s=>({id:s.id,name:s.name,domain:s.domain,difficulty:Math.max(1,6-s.level),dependencies:s.prerequisites,tags:[s.domain]}));
  const states:SkillState[]=current.profile.skills;
  const goals:LearningGoal[]=current.profile.skills.map(s=>({id:s.id,title:s.name,targetLevel:s.target,priority:Math.max(1,s.gap)}));
  const decision=adaptLearning({tenantId,skills,states,goals,reason});
  if(cfg()) await persist(tenantId,"MASTERY_ADAPTATION",decision as unknown as Record<string,unknown>);
  return decision;
}
