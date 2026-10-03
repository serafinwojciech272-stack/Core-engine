import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/security";
import { resolveSaaSTenant } from "@/lib/saas-tenant";
import { promoteAndPersistRecoveryLearning } from "@/lib/m24-26-learning-promotion-engine";
import { createSupabaseRecoveryLearningPromotionPersistence } from "@/lib/m24-26-learning-promotion-persistence";
import { SupabaseRecoveryVerificationPersistence } from "@/lib/m24-25-verification-persistence";

export async function POST(request: Request) {
  try {
    await guardMutation(request);
    const tenant = await resolveSaaSTenant(request);
    const body = await request.json() as { recoveryKey?: string; executionId?: string };

    if (!body.recoveryKey || !body.executionId) {
      return NextResponse.json({ error: "RECOVERY_LEARNING_PROMOTION_INPUT_INVALID" }, { status: 400 });
    }

    const verification = await new SupabaseRecoveryVerificationPersistence(
      async (name, rpcBody) => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
        const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`SUPABASE_RPC_${response.status}`);
        return response.json();
      },
    ).read(tenant.id, body.recoveryKey);

    if (!verification || verification.executionId !== body.executionId) {
      return NextResponse.json({ error: "RECOVERY_VERIFICATION_NOT_FOUND" }, { status: 404 });
    }
    if (verification.tenantId !== tenant.id || verification.recoveryKey !== body.recoveryKey) {
      return NextResponse.json({ error: "RECOVERY_VERIFICATION_SCOPE_MISMATCH" }, { status: 403 });
    }

    const promotion = await promoteAndPersistRecoveryLearning(
      verification,
      createSupabaseRecoveryLearningPromotionPersistence(),
    );

    return NextResponse.json({
      ...promotion,
      flow: "OUTCOME → LEARNING → LEARNING PROMOTION → DECISION POLICY UPDATE",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_LEARNING_PROMOTION_FAILED";
    const status = message.includes("SCOPE") || message.includes("TENANT") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
