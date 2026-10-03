import test from "node:test";
import assert from "node:assert/strict";
import { SupabaseAtomicRecoveryCommit } from "@/lib/recovery-supabase-adapter";

test("M24.17 adapter sends recovery contract to one atomic RPC", async () => {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  const adapter = new SupabaseAtomicRecoveryCommit(async (name, body) => {
    calls.push({ name, body });
    return {
      status: "COMMITTED",
      commitId: "commit-1",
      checkpointId: "checkpoint-1",
      learningId: "learning-1",
      payloadHash: String(body.p_payload_hash),
    };
  });

  const result = await adapter.commit({
    tenantId: "tenant-1",
    idempotencyKey: "broker-close-100",
    recoveryKey: "broker-1",
    checkpoint: {
      streamKey: "broker-1",
      cursor: "100",
      state: { closed: true },
    },
    learning: {
      lessonType: "POSITIVE_DELTA",
      quality: "VERIFIED",
      lesson: "close recovered",
      reason: "verified",
    },
    metadata: { source: "BROKER_CLOSE" },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "ce_atomic_recovery_commit");
  assert.equal(calls[0].body.p_tenant_id, "tenant-1");
  assert.equal(calls[0].body.p_idempotency_key, "broker-close-100");
  assert.deepEqual(calls[0].body.p_checkpoint, {
    streamKey: "broker-1",
    cursor: "100",
    state: { closed: true },
  });
  assert.deepEqual(calls[0].body.p_learning, {
    lessonType: "POSITIVE_DELTA",
    quality: "VERIFIED",
    lesson: "close recovered",
    reason: "verified",
  });
  assert.equal(result.status, "COMMITTED");
});
