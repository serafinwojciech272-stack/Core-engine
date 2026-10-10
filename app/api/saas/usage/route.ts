import { authorizeTenant } from "@/lib/http";
import {NextResponse} from "next/server";
import {resolveSaaSContext,getSaaSUsage} from "@/lib/saas-runtime";

export async function GET(request:Request){
  const auth = await authorizeTenant(request); if (!auth.ok) return auth.response;
  try{
    const runtime=await resolveSaaSContext(request);
    const tenantId=runtime.identity?.tenantId||runtime.legacyTenant?.tenantId;
    if(!tenantId)throw new Error("TENANT_NOT_CONFIGURED");
    const quota=await getSaaSUsage(tenantId);
    return NextResponse.json({ok:true,tenantId,quota});
  }catch(error){
    const message=error instanceof Error?error.message:"USAGE_READ_FAILED";
    return NextResponse.json({ok:false,error:message},{status:401});
  }
}
