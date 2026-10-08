import { randomUUID } from "node:crypto";
import { universalGenerate } from "@/lib/universal-ai-router";
import { seedMasteryProfile, seedMasteryRoadmap } from "./seed";
import type { MasteryProfile, MasteryRoadmap } from "./contracts";

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
};
mem.__mastery ??= new Map();

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

async function persist(tenantId: string, state: "MASTERY_PROFILE" | "MASTERY_ROADMAP", payload: Record<string, unknown>) {
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

async function aiJson(task: string, context: string) {
  const result = await universalGenerate(task, context, "", 35000);
  if (!result.ok || !result.text) return null;
  const match = result.text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { return null; }
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
  const result = await universalGenerate(
    "Research current developments relevant to AI mastery for this topic. Prefer primary sources. Separate facts, implications, uncertainty and recommended roadmap changes. Use web search when needed.",
    JSON.stringify({ topic, profile: current.profile, roadmap: current.roadmap }),
    "",
    45000
  );
  return {
    topic,
    result: result.text || "Research unavailable",
    routing: result.routing,
    requestId: result.requestId
  };
}
