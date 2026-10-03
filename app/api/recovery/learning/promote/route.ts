import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/security";
import { resolveSaaSTenant } from "@/lib/saas-tenant";
import { promoteAndPersistRecoveryLearning } from "@/lib/m24-26-learning-promotion-engine";
import { createSupabaseRecoveryLearningPromotionPersistence } from "@/lib/m24-26-learning-promotion-persistence";

export async function POST(request: Request) {
  try {
    await guardMutation(request);
    const tenant = await resolveSaaSTenant(request);
    const body = await request.json() as {
      recoveryKey?: string;
      executionId?: string;
      action?: "RESUME" | "REPLAY" | "RECONCILE";
      outcome?: "SUCCESS" | "PARTIAL" | "FAILED" | "UNVERIFIED";
      learningSignal?: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
      learningVersion?: number;
    };

    if (!body.recoveryKey || !body.executionId || !body.action || !body.outcome || !body.learningSignal) {
      return NextResponse.json({ error: "RECOVERY_LEARNING_PROMOTION_INPUT_INVALID" }, { status: 400 });
    }

    const promotion = await promoteAndPersistRecoveryLearning({
      tenantId: tenant.id,
      recoveryKey: body.recoveryKey,
      executionId: body.executionId,
      action: body.action,
      outcome: body.outcome,
      learningSignal: body.learningSignal,
      matchedKeys: [],
      mismatchedKeys: [],
      verificationHash: "",
      verifiedAt: new Date().toISOString(),
      reason: "PROMOTION_FROM_VERIFICATION",
      learningVersion: body.learningVersion,
    }, createSupabaseRecoveryLearningPromotionPersistence());

    return NextResponse.json({
      ...promotion,
      flow: "OUTCOME → LEARNING → LEARNING PROMOTION → DECISION POLICY UPDATE",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_LEARNING_PROMOTION_FAILED";
    const status = message.includes("TENANT") || message.includes("SCOPE") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
