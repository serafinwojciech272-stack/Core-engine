import { NextResponse } from "next/server";
import { computeJobLearning } from "@/lib/job-learning";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function authorized(request:Request){
  const secret=process.env.CRON_SECRET;
  return !secret ? process.env.NODE_ENV!=="production" : request.headers.get("authorization")==="Bearer "+secret;
}
async function sb(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SUPABASE_SERVER_CONFIG_MISSING");return{url,key}}
async function requestSb(path:string,init:RequestInit={}){const c=await sb();const r=await fetch(c.url+"/rest/v1/"+path,{...init,headers:{apikey:c.key,Authorization:"Bearer "+c.key,"Content-Type":"application/json",...(init.headers||{})},cache:"no-store"});if(!r.ok)throw new Error("SUPABASE_"+r.status);return r}
export async function POST(request:Request){
 if(!authorized(request))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});
 try{
  const body=await request.json() as {jobId?:string;outcomeType?:string;value?:string;score?:number;metadata?:Record<string,unknown>};
  if(!body.jobId||!body.outcomeType)return NextResponse.json({ok:false,error:"JOB_ID_AND_OUTCOME_TYPE_REQUIRED"},{status:400});
  const allowed=["ACCEPTED","REJECTED","APPLIED","RESPONSE","INTERVIEW","OFFER","WITHDRAWN"];
  if(!allowed.includes(body.outcomeType))return NextResponse.json({ok:false,error:"INVALID_OUTCOME_TYPE"},{status:400});
  const jobRes=await requestSb("job_opportunities?id=eq."+encodeURIComponent(body.jobId)+"&select=id,match_score,status&limit=1");
  const jobs=await jobRes.json() as Array<{id:string;match_score:number|null;status:string}>;
  if(!jobs[0])return NextResponse.json({ok:false,error:"JOB_NOT_FOUND"},{status:404});
  const metadata={...(body.metadata||{}),match_score:jobs[0].match_score};
  const outcome=await requestSb("job_outcomes",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({job_id:body.jobId,outcome_type:body.outcomeType,value:body.value||null,score:body.score??null,metadata})});
  const statusMap:Record<string,string>={ACCEPTED:"ACCEPTED",REJECTED:"REJECTED",APPLIED:"APPLIED",RESPONSE:"RESPONDED",INTERVIEW:"INTERVIEW",OFFER:"OFFER",WITHDRAWN:"WITHDRAWN"};
  await requestSb("job_opportunities?id=eq."+encodeURIComponent(body.jobId),{method:"PATCH",body:JSON.stringify({status:statusMap[body.outcomeType]||jobs[0].status})});
  await requestSb("job_events",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify([{job_id:body.jobId,event_type:"OUTCOME_RECORDED",actor:"core_engine",from_status:jobs[0].status,to_status:statusMap[body.outcomeType],metadata:{outcome_type:body.outcomeType,value:body.value||null}}])});
  return NextResponse.json({ok:true,outcome:await outcome.json()});
 }catch(e){return NextResponse.json({ok:false,error:String(e)},{status:503});}
}