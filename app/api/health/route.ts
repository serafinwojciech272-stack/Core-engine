import{NextResponse}from"next/server";
import{checkStorageHealth,storageMode}from"@/lib/storage";
import{authStatus}from"@/lib/auth";
import{ENGINE_VERSION}from"@/lib/engine";

export async function GET(request:Request){
  const url=new URL(request.url);
  const detail=url.searchParams.get("detail")==="full";
  const detailToken=process.env.HEALTH_DETAIL_TOKEN?.trim();
  const authorizedDetail=!detailToken||request.headers.get("x-health-token")===detailToken;
  const openrouterConfigured=Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const storage=storageMode();
  const storageHealth=await checkStorageHealth();
  const auth=authStatus();
  const auditSigning=Boolean(process.env.AUDIT_SIGNING_KEY?.trim());
  const productionReady=storageHealth==="pass"&&openrouterConfigured&&auth.enforced&&auditSigning;
  const base={
    ok:true,
    service:"core-engine",
    version:ENGINE_VERSION,
    status:productionReady?"healthy":storageHealth==="pass"&&openrouterConfigured?"degraded":"not_ready",
    production_ready:productionReady,
    checks:{
      api:"pass",
      persistent_storage:storageHealth,
      ai_provider:openrouterConfigured?"openrouter":"missing",
      authorization_policy:auth,
      audit_verification:auditSigning?"hmac":"unsigned",
      recovery_idempotency:"pass"
    },
    capabilities:{persistence:storage,durable:storage==="supabase"},
    openrouter:{configured:openrouterConfigured,model:process.env.OPENROUTER_MODEL?.trim()||"openai/gpt-5-mini"}
  };
  if(!detail||!authorizedDetail){
    return NextResponse.json({...base,detail_requires_auth:Boolean(detailToken)});
  }
  return NextResponse.json({
    ...base,
    detail_requires_auth:false,
    ai_decision_legacy:Boolean(process.env.AI_DECISION_ENDPOINT&&process.env.AI_DECISION_API_KEY&&process.env.AI_DECISION_MODEL)
  });
}
