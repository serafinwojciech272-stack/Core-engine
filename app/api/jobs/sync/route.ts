import { NextResponse } from "next/server";
import { discoverJobs, scoreJobs } from "@/lib/job-discovery";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function authorized(request:Request){
 const cron=request.headers.get("authorization");
 const secret=process.env.CRON_SECRET;
 if(secret && cron==="Bearer "+secret)return true;
 return process.env.NODE_ENV!=="production";
}
async function sb(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key}}
async function requestSb(path:string,init:RequestInit={}){const c=await sb();const r=await fetch(c.url+"/rest/v1/"+path,{...init,headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json",...(init.headers||{})},cache:"no-store"});if(!r.ok)throw new Error("SUPABASE_"+r.status);return r}
export async function GET(request:Request){return POST(request)}
export async function POST(request:Request){
 if(!authorized(request))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});
 const started=Date.now(); let runId:string|undefined;
 try{
  const run=await requestSb("job_sync_runs",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({status:"RUNNING"})});
  runId=((await run.json()) as Array<{id:string}>)[0]?.id;
  const found=await discoverJobs(); const {policy,scored}=await scoreJobs(found.jobs);
  let inserted=0;
  for(const j of scored){
   const payload={source:j.source,url:j.url,title:j.title,company:j.company,location:j.location,salary:j.salary,description:j.description,published_at:j.publishedAt,content_hash:null,match_score:j.matchScore,decision:j.decision,decision_reason:j.decisionReason,application_mode:j.applicationMode,status:"NEW",raw:j.raw};
   const r=await requestSb("job_opportunities?on_conflict=source,url",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(payload)});
   if(r.ok)inserted++;
  }
  if(runId)await requestSb("job_sync_runs?id=eq."+encodeURIComponent(runId),{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({finished_at:new Date().toISOString(),discovered:scored.length,inserted,errors:found.errors,status:"COMPLETE"})});
  return NextResponse.json({ok:true,sync:{durationMs:Date.now()-started,discovered:scored.length,inserted,errors:found.errors,policy:{confidence:policy.confidence,priority:policy.priority}},sources:["pracuj.pl","indeed","olx","linkedin","nofluffjobs","justjoin.it","rocketjobs","pracapolis","adzuna","jooble"],criteria:"Gliwice + 30 km"});
 }catch(e){
  if(runId)try{await requestSb("job_sync_runs?id=eq."+encodeURIComponent(runId),{method:"PATCH",body:JSON.stringify({finished_at:new Date().toISOString(),errors:[String(e)],status:"FAILED"})})}catch{}
  return NextResponse.json({ok:false,error:String(e),durationMs:Date.now()-started},{status:503});
 }
}
