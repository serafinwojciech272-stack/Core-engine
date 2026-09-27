import {NextResponse} from "next/server";
import {resolveSaaSContext,saasStatus} from "@/lib/saas-runtime";

export async function GET(request:Request){
  try{
    const runtime=await resolveSaaSContext(request);
    return NextResponse.json({ok:true,saas:saasStatus(),identity:runtime.identity?{userId:runtime.identity.userId,email:runtime.identity.email,tenantId:runtime.identity.tenantId,tenantName:runtime.identity.tenantName,workspaceId:runtime.identity.workspaceId,workspaceSlug:runtime.identity.workspaceSlug,role:runtime.identity.role}:null,legacyTenant:runtime.legacyTenant?{tenantId:runtime.legacyTenant.tenantId,tenantKey:runtime.legacyTenant.tenantKey}:null});
  }catch(error){
    const message=error instanceof Error?error.message:"SAAS_RUNTIME_FAILED";
    return NextResponse.json({ok:false,error:message},{status:401});
  }
}
