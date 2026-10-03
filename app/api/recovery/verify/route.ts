import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resolveSaaSContext } from "@/lib/saas-runtime";
import { verifyRecoveryExecution } from "@/lib/m24-25-verification-engine";
import { createSupabaseRecoveryVerificationPersistence } from "@/lib/m24-25-verification-persistence";
import type { RecoveryExecutionEvent } from "@/lib/recovery-executor";

export async function POST(request:Request){
 const guard=guardMutation(request,"recovery-verify");if(guard)return guard;
 const runtime=await resolveSaaSContext(request);const tenantId=runtime.identity?.tenantId??runtime.legacyTenant?.tenantId;if(!tenantId)return NextResponse.json({ok:false,error:"TENANT_REQUIRED"},{status:401});
 const rl=rateLimit("recovery-verify:"+tenantId);if(!rl.allowed)return NextResponse.json({ok:false,error:"RATE_LIMITED"},{status:429});
 const body=await request.json().catch(()=>null) as {recoveryKey?:string;execution?:RecoveryExecutionEvent;expectedState?:Record<string,unknown>;observedState?:Record<string,unknown>}|null;
 if(!body?.recoveryKey||!body.execution||!body.expectedState||!body.observedState)return NextResponse.json({ok:false,error:"RECOVERY_VERIFICATION_INPUT_INVALID"},{status:400});
 try{const result=verifyRecoveryExecution({tenantId,recoveryKey:body.recoveryKey,execution:body.execution,expectedState:body.expectedState,observedState:body.observedState});await createSupabaseRecoveryVerificationPersistence().commit(result,body.observedState);return NextResponse.json({ok:true,flow:"POST-EXECUTION VERIFICATION → OUTCOME → LEARNING",result},{status:201});}catch(error){const message=error instanceof Error?error.message:"RECOVERY_VERIFICATION_FAILED";return NextResponse.json({ok:false,error:message},{status:message.includes("SCOPE")?403:400});}
}
