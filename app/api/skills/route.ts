import {NextResponse} from "next/server";
import {registerBuiltInSkillPacks} from "@/lib/skill-runtime";
import {listSkillPacks,listSkillAdapters} from "@/lib/skill-runtime";
export async function GET(){registerBuiltInSkillPacks();return NextResponse.json({ok:true,runtime:"skill-runtime-v2",executionMode:"PLAN_ONLY",adapters:listSkillAdapters().map(a=>({id:a.id,version:a.version,capabilities:a.capabilities,idempotencySupport:a.idempotencySupport})),skills:listSkillPacks().map(p=>({id:p.id,name:p.name,version:p.version,description:p.description,categories:p.categories,signals:p.signals,actions:p.actions}))});}
