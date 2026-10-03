import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { resolveTenant } from "@/lib/commercial-runtime";
import { createSupabaseRecoveryLearningPolicyPersistence } from "@/lib/m24-27-learning-policy-persistence";

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, "recovery-learning-policy");
    if (guard) return guard;
    const tenant = resolveTenant(request);
    const body = await request.json() as { recoveryKey?: string };
    if (!body.recoveryKey) return NextResponse.json({error:"RECOVERY_LEARNING_POLICY_INPUT_INVALID"},{status:400});
    const policies = await createSupabaseRecoveryLearningPolicyPersistence().aggregate(tenant.id, body.recoveryKey);
    return NextResponse.json({
      tenantId: tenant.id, recoveryKey: body.recoveryKey, policies,
      flow:"PROMOTED LEARNING → POLICY AGGREGATION → STABLE RECOVERY POLICY",
    });
  } catch (error) {
    const message=error instanceof Error?error.message:"RECOVERY_LEARNING_POLICY_AGGREGATION_FAILED";
    return NextResponse.json({error:message},{status:message.includes("SCOPE")?403:400});
  }
}

export async function GET(request: Request) {
  try {
    const tenant = await resolveSaaSTenant(request);
    const recoveryKey = new URL(request.url).searchParams.get("recoveryKey");
    if (!recoveryKey) return NextResponse.json({error:"RECOVERY_LEARNING_POLICY_INPUT_INVALID"},{status:400});
    const policies=await createSupabaseRecoveryLearningPolicyPersistence().read(tenant.id,recoveryKey);
    return NextResponse.json({tenantId:tenant.id,recoveryKey,policies});
  } catch (error) {
    const message=error instanceof Error?error.message:"RECOVERY_LEARNING_POLICY_READ_FAILED";
    return NextResponse.json({error:message}, {status:400});
  }
}