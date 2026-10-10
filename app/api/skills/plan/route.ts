import { guardMutation } from "@/lib/http";
import {NextResponse} from "next/server";
import {registerBuiltInSkillPacks,planSkills} from "@/lib/skill-runtime";
export async function POST(request:Request){
  { const guard = guardMutation(request, "skills-plan"); if (guard) return guard; }registerBuiltInSkillPacks();let body:unknown;try{body=await request.json();}catch{return NextResponse.json({ok:false,error:"INVALID_JSON"},{status:400});}if(!body||typeof body!=="object"||typeof (body as Record<string,unknown>).objective!=="string")return NextResponse.json({ok:false,error:"OBJECTIVE_REQUIRED"},{status:400});const b=body as Record<string,unknown>;const plan=planSkills({objective:String(b.objective),locale:typeof b.locale==="string"?b.locale:"en-US",executionMode:"PLAN_ONLY"});return NextResponse.json({ok:true,...plan});}
