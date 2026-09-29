import {NextResponse} from "next/server";
import {guardMutation} from "@/lib/http";
import {resolveSaaSContext} from "@/lib/saas-runtime";
import {runBusinessAudit} from "@/lib/business-audit";
import {buildCommercialDemoPlan} from "@/lib/commercial-demo-plan";

export async function POST(request:Request){
  const guard=guardMutation(request,"commercial-plan");
  if(guard)return guard;
  try{
    const runtime=await resolveSaaSContext(request);
    const tenantId=runtime.identity?.tenantId??runtime.legacyTenant?.tenantId;
    if(!tenantId)return NextResponse.json({ok:false,error:"TENANT_REQUIRED"},{status:401});
    const body=await request.json() as Record<string,unknown>;
    const url=typeof body.url==="string"?body.url.trim():"";
    const key=request.headers.get("x-idempotency-key")?.trim()||(typeof body.idempotencyKey==="string"?body.idempotencyKey.trim():"");
    if(!url)return NextResponse.json({ok:false,error:"URL_REQUIRED"},{status:400});
    if(!key||key.length>200)return NextResponse.json({ok:false,error:"IDEMPOTENCY_KEY_REQUIRED"},{status:400});
    const audit=await runBusinessAudit({url,idempotencyKey:key+":audit",missionId:"commercial-plan:"+tenantId});
    const plan=buildCommercialDemoPlan(audit);
    return NextResponse.json({ok:true,audit,plan,tenantId,persistence:"runtime",durable:false});
  }catch(error){
    const message=error instanceof Error?error.message:"COMMERCIAL_PLAN_FAILED";
    const status=/PRIVATE_URL|UNSUPPORTED_URL|URL_REQUIRED|IDEMPOTENCY|POLICY_MISMATCH|NOT_REGISTERED/.test(message)?400:503;
    return NextResponse.json({ok:false,error:message},{status});
  }
}
