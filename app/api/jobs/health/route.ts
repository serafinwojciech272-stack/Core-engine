import { NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const databaseConfigured=Boolean(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  const searchConfigured=Boolean(process.env.SERPER_API_KEY);
  let databaseReachable=false;
  let databaseError:string|undefined;

  if(databaseConfigured){
    try{
      const url=process.env.SUPABASE_URL!;
      const key=(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!;
      const r=await fetch(url+"/rest/v1/job_sync_runs?select=id&limit=1",{
        headers:{apikey:key,Authorization:"Bearer "+key},
        cache:"no-store",
        signal:AbortSignal.timeout(8000)
      });
      databaseReachable=r.ok;
      if(!r.ok) databaseError="SUPABASE_"+r.status;
    }catch(e){ databaseError=String(e); }
  }

  return NextResponse.json({
    ok:databaseConfigured&&databaseReachable&&searchConfigured,
    service:"job-agent",
    pipeline:"LIVE_WEB -> DISCOVERY -> DEDUPE -> GEO_FILTER -> PROFILE_MATCH -> LEARNING_SCORE -> REVIEW",
    config:{searchConfigured,databaseConfigured,databaseReachable},
    databaseError,
    applicationPolicy:"REVIEW_BEFORE_SUBMIT",
    missing:[
      ...(!searchConfigured?["SERPER_API_KEY"]:[]),
      ...(!databaseConfigured?["SUPABASE_URL","SUPABASE_SECRET_KEY_OR_SUPABASE_SERVICE_ROLE_KEY"]:[]),
      ...(databaseConfigured&&!databaseReachable?["SUPABASE_REACHABILITY"]:[])
    ]
  });
}
