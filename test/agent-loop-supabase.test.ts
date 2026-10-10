// Integration test of SupabaseRunStore against a real PostgREST + Postgres with migration
// 20261010090000_ce_agent_jobs.sql applied. Skipped unless AGENT_STORE_PGRST_URL and
// AGENT_STORE_PGRST_KEY (a service_role JWT) are set — see eval/README.md for the local setup.
import test from "node:test";
import assert from "node:assert/strict";
import { SupabaseRunStore, VersionConflictError } from "@/lib/agent-loop/store";
import { AgentRunner, newRun, decideApproval } from "@/lib/agent-loop/runner";
import type { LlmClient } from "@/lib/agent-loop/llm";

const url = process.env.AGENT_STORE_PGRST_URL;
const key = process.env.AGENT_STORE_PGRST_KEY;
const skip = !url || !key;
const store = () => new SupabaseRunStore({ url: url!, key: key!, restPath: process.env.AGENT_STORE_PGRST_PATH ?? "" });
const tenant = "it-" + Date.now();

test("create / get / CAS save / list", { skip }, async () => {
  const s = store();
  const run = newRun({ tenantId: tenant, goal: "integration" });
  await s.create(run);
  await assert.rejects(s.create(run), /RUN_EXISTS/);
  const loaded = await s.get(run.id);
  assert.equal(loaded?.goal, "integration");
  const saved = await s.save({ ...loaded!, goal: "changed" });
  assert.equal(saved.version, 1);
  await assert.rejects(s.save({ ...loaded!, goal: "stale" }), VersionConflictError);
  assert.equal((await s.get(run.id))?.goal, "changed");
  assert.ok((await s.list(tenant)).some((r) => r.id === run.id));
  await s.save({ ...saved, status: "CANCELLED" }); // keep the queue clean for the next tests
});

test("concurrent workers never claim the same job (FOR UPDATE SKIP LOCKED)", { skip }, async () => {
  const s = store();
  const ids = new Set<string>();
  for (let i = 0; i < 5; i++) { const r = newRun({ tenantId: tenant, goal: "claim-" + i }); ids.add(r.id); await s.create(r); }
  const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => s.claimNext("w" + i, 60_000)));
  const won = claims.filter((c): c is NonNullable<typeof c> => Boolean(c) && ids.has(c!.id));
  assert.equal(won.length, 5, "each job claimed exactly once");
  assert.equal(new Set(won.map((c) => c.id)).size, 5);
  for (const c of won) {
    assert.equal(c.status, "RUNNING");
    assert.ok(c.lease && c.lease.expiresAt > Date.now(), "lease mirrored into the run document");
    await s.save({ ...c, status: "CANCELLED", lease: undefined });
  }
});

test("a full agent run with approval pause survives a worker restart", { skip }, async () => {
  const s = store();
  let turn = 0;
  const llm: LlmClient = {
    model: "scripted",
    async complete() {
      turn++;
      const message = turn === 1
        ? { content: null, tool_calls: [{ id: "w1", type: "function" as const, function: { name: "workspace_write", arguments: JSON.stringify({ path: "PLAN.md", content: "1. mail" }) } }] }
        : turn === 2
          ? { content: null, tool_calls: [{ id: "m1", type: "function" as const, function: { name: "send_email", arguments: JSON.stringify({ to: "a@b.c", subject: "s", body: "b" }) } }] }
          : { content: "Mail nie został wysłany — odrzucono." };
      return { message, usage: { promptTokens: 10, completionTokens: 5, costUsd: 0 }, model: "scripted", finishReason: null };
    },
  };
  const run = newRun({ tenantId: tenant, goal: "plan then mail" });
  await s.create(run);
  await new AgentRunner({ store: s, llm, owner: "worker-A" }).drainQueue(1);
  const paused = (await s.get(run.id))!;
  assert.equal(paused.status, "WAITING_APPROVAL");
  assert.ok("PLAN.md" in paused.workspace);
  await decideApproval(s, run.id, tenant, "REJECTED");
  await new AgentRunner({ store: store(), llm, owner: "worker-B" }).drainQueue(1); // a different process/instance
  const done = (await s.get(run.id))!;
  assert.equal(done.status, "COMPLETED");
  assert.match(done.result!.summary, /nie został wysłany/);
  assert.ok(done.version > paused.version);
});
