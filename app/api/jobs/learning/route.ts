import { NextResponse } from "next/server";
import { computeJobLearning } from "@/lib/job-learning";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function authorized(request:Request){const secret=process.env.CRON_SECRET;return !secret?process.env.NODE_ENV!=="production":request.headers.get("authorization")==="Bearer "+secret}
async function sb(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key}}
async function get(path:string){const c=await sb();const r=await fetch(c.url+"/rest/v1/"+path,{headers:{apikey:c.key,Authorization:"Bearer "+c.key},cache:"no-store"});if(!r.ok)throw new Error("SUPABASE_"+r.status);return r.json()}
async function requestSb(path:string,init:RequestInit={}){const c=await sb();const r=await fetch(c.url+"/rest/v1/"+path,{...init,headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json",...(init.headers||{})},cache:"no-store"});if(!r.ok)throw new Error("SUPABASE_"+r.status);return r}
export async function GET(request:Request){if(!authorized(request))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});try{const rows=await get("job_outcomes?select=outcome_type,metadata&order=created_at.desc&limit=5000");const profile=await computeJobLearning(rows);return NextResponse.json({ok:true,profile})}catch(e){return NextResponse.json({ok:false,error:String(e)},{status:503})}}
export async function POST(request:Request){if(!authorized(request))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});try{const rows=await get("job_outcomes?select=outcome_type,metadata&order=created_at.desc&limit=5000");const profile=await computeJobLearning(rows);await requestSb("job_learning_profiles?on_conflict=profile_key",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify({profile_key:"default-job-agent",...profile,updated_at:new Date().toISOString()})});return NextResponse.json({ok:true,profile,updatedAt:new Date().toISOString()})}catch(e){return NextResponse.json({ok:false,error:String(e)},{status:503})}}
