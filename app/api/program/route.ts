import { NextResponse } from "next/server";
import { approveProgram, buildCheckpoint, continueProgram, createProgram, enforceScope, expandProgram, executionGate, validateProgram, type ProgramPlan } from "@/lib/program-engine";

const MAX_BODY_BYTES = 32_000;
const mem = globalThis as typeof globalThis & { __corePrograms?: Map<string, ProgramPlan> };
if (!mem.__corePrograms) mem.__corePrograms = new Map();

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}
async function persist(plan: ProgramPlan, event: Record<string, unknown>) {
  const config = supabaseConfig();
  if (!config) return "memory";
  const response = await fetch(config.url + "/rest/v1/ce_program_runs", {
    method: "POST",
    cache: "no-store",
    headers: { apikey: config.key, Authorization: "Bearer " + config.key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: plan.programId, objective: plan.objective, status: plan.status, scope: plan.scope, stages: plan.stages, next_stage: plan.nextStage, version: plan.version })
  });
  if (!response.ok) throw new Error("PROGRAM_PERSIST_" + response.status);
  await fetch(config.url + "/rest/v1/ce_program_events", {
    method: "POST", cache: "no-store",
    headers: { apikey: config.key, Authorization: "Bearer " + config.key, "Content-Type": "application/json" },
    body: JSON.stringify({ program_id: plan.programId, event_type: String(event.type ?? "STATE_CHANGED"), payload: event })
  });
  return "supabase";
}
async function load(id: string): Promise<ProgramPlan | null> {
  const config = supabaseConfig();
  if (!config) return mem.__corePrograms?.get(id) ?? null;
  const r = await fetch(config.url + "/rest/v1/ce_program_runs?id=eq." + encodeURIComponent(id) + "&select=*", { cache: "no-store", headers: { apikey: config.key, Authorization: "Bearer " + config.key } });
  if (!r.ok) throw new Error("PROGRAM_READ_" + r.status);
  const rows = await r.json() as Array<Record<string, unknown>>;
  if (!rows[0]) return null;
  const row = rows[0];
  return { programId: String(row.id), version: row.version as ProgramPlan["version"], status: row.status as ProgramPlan["status"], objective: String(row.objective), scope: row.scope as ProgramPlan["scope"], stages: row.stages as ProgramPlan["stages"], nextStage: row.next_stage === null ? null : Number(row.next_stage), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: true, service: "program-engine", stages: 101 });
  const plan = await load(id);
  return plan ? NextResponse.json({ ok: true, plan, validation: validateProgram(plan) }) : NextResponse.json({ ok: false, error: "PROGRAM_NOT_FOUND" }, { status: 404 });
}
export async function POST(request: Request) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ ok:false,error:"REQUEST_TOO_LARGE" },{status:413});
  let body: Record<string, unknown>;
  try { body = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ok:false,error:"INVALID_JSON"},{status:400}); }
  try {
    let plan: ProgramPlan | null = null;
    const action = String(body.action ?? "plan");
    if (action === "plan") {
      plan = createProgram(String(body.objective ?? "Complete the Core Engine autonomous execution program."), body.scope as Partial<ProgramPlan["scope"]> | undefined);
      mem.__corePrograms?.set(plan.programId, plan);
      const persistence = await persist(plan, { type: "PROGRAM_CREATED", stages: plan.stages.length });
      return NextResponse.json({ok:true, action, plan, validation:validateProgram(plan), persistence});
    }
    const id = String(body.programId ?? "");
    if (!id) return NextResponse.json({ok:false,error:"PROGRAM_ID_REQUIRED"},{status:400});
    const loaded = await load(id);
    if (!loaded) return NextResponse.json({ok:false,error:"PROGRAM_NOT_FOUND"},{status:404});
    plan = loaded;
    if (action === "validate") return NextResponse.json({ok:true,action,validation:validateProgram(plan),plan});
    if (action === "scope") return NextResponse.json({ok:true,action,scope:enforceScope(plan,String(body.domain??"business"),String(body.toolAction??"analyze"))});
    if (action === "approve") {
      plan = approveProgram(plan);
      mem.__corePrograms?.set(plan!.programId,plan!);
      return NextResponse.json({ok:true,action,plan,persistence:await persist(plan,{type:"PROGRAM_APPROVED"})});
    }
    if (action === "checkpoint") {
      const checkpoint=buildCheckpoint(plan);
      const persistence=await persist(plan,{type:"CHECKPOINT_CREATED",checkpoint});
      if (persistence === "supabase") {
        const config=supabaseConfig();
        if (config) {
          const cp=await fetch(config.url + "/rest/v1/ce_program_checkpoints", { method:"POST", cache:"no-store", headers:{apikey:config.key,Authorization:"Bearer "+config.key,"Content-Type":"application/json"}, body:JSON.stringify({id:checkpoint.checkpointId,program_id:checkpoint.programId,stage_id:checkpoint.stageId,state:checkpoint.state,next_stage:checkpoint.nextStage,integrity:checkpoint.integrity}) });
          if(!cp.ok) throw new Error("PROGRAM_CHECKPOINT_PERSIST_"+cp.status);
        }
      }
      return NextResponse.json({ok:true,action,checkpoint,persistence});
    }
    if (action === "execute") {
      const stage=plan.stages.find(s=>s.id===plan.nextStage);
      if(!stage) return NextResponse.json({ok:true,action,status:"COMPLETED",plan});
      const gate=executionGate(plan,stage);
      if(!gate.allowed) return NextResponse.json({ok:false,action,error:"EXECUTION_GATE_BLOCKED",reason:gate.reason,plan},{status:409});
      plan={...plan!,stages:plan!.stages.map(s=>s.id===stage.id?{...s,status:"RUNNING",evidence:[...s.evidence,"transaction_boundary_open","validation_evidence_ready"]}:s),updatedAt:new Date().toISOString()};
      mem.__corePrograms?.set(plan.programId,plan);
      return NextResponse.json({ok:true,action,stage,plan,persistence:await persist(plan,{type:"STAGE_EXECUTION_STARTED",stageId:stage.id})});
    }
    if (action === "continue") {
      plan=continueProgram(plan);
      mem.__corePrograms?.set(plan.programId,plan);
      return NextResponse.json({ok:true,action,plan,persistence:await persist(plan,{type:"PROGRAM_CONTINUED",nextStage:plan.nextStage})});
    }
    if (action === "expand") {
      plan=expandProgram(plan,Number(body.count??1));
      mem.__corePrograms?.set(plan.programId,plan);
      return NextResponse.json({ok:true,action,plan,persistence:await persist(plan,{type:"STAGES_EXPANDED",count:Number(body.count??1)})});
    }
    return NextResponse.json({ok:false,error:"UNKNOWN_PROGRAM_ACTION"},{status:400});
  } catch { return NextResponse.json({ok:false,error:"PROGRAM_OPERATION_FAILED"},{status:503}); }
}
