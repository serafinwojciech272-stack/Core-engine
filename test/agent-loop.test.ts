import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentRunner, newRun, decideApproval, resumeRun, cancelRun, compactMessages } from "@/lib/agent-loop/runner";
import { MemoryRunStore, FileRunStore, VersionConflictError } from "@/lib/agent-loop/store";
import { LlmError, createOpenAiCompatibleClient, type LlmClient, type LlmRequest, type LlmResponse } from "@/lib/agent-loop/llm";
import { builtinTools } from "@/lib/agent-loop/tools";
import type { AgentTool, ChatMessage } from "@/lib/agent-loop/contracts";
import { resolveTenant } from "@/lib/commercial-runtime";

type Turn = LlmResponse["message"] | Error | ((req: LlmRequest) => LlmResponse["message"]);

function scriptedLlm(turns: Turn[]) {
  const requests: LlmRequest[] = [];
  const client: LlmClient & { requests: LlmRequest[] } = {
    model: "scripted", requests,
    async complete(req) {
      requests.push(req);
      const turn = turns.shift();
      if (!turn) throw new LlmError("SCRIPT_EXHAUSTED", false);
      if (turn instanceof Error) throw turn;
      const raw = typeof turn === "function" ? turn(req) : turn;
      const { finishReason, ...message } = raw as LlmResponse["message"] & { finishReason?: string };
      return { message, usage: { promptTokens: 100, completionTokens: 20, costUsd: 0.001 }, model: "scripted", finishReason: finishReason ?? null };
    },
  };
  return client;
}

let n = 0;
const call = (name: string, args: Record<string, unknown>) => ({ content: null, tool_calls: [{ id: `c${++n}`, type: "function" as const, function: { name, arguments: JSON.stringify(args) } }] });
const finish = (summary: string, criteria: Array<[string, boolean, string]>) => call("finish", { summary, criteria: criteria.map(([criterion, met, evidence]) => ({ criterion, met, evidence })) });

function weatherTool(log: string[]): AgentTool {
  return { name: "weather_current", description: "weather", parameters: { type: "object" }, sideEffect: false,
    async execute(args) { log.push(String(args.city)); return { status: "EXECUTED", output: { city: args.city, tempC: 11 } }; } };
}

async function runToEnd(runner: AgentRunner, store: MemoryRunStore | FileRunStore, id: string) {
  await runner.drainQueue();
  return (await store.get(id))!;
}

test("executes the tool the model chose (no keyword routing) and completes", async () => {
  const store = new MemoryRunStore(); const log: string[] = [];
  const llm = scriptedLlm([call("weather_current", { city: "Gdańsk" }), { content: "Tak, weź parasol — w Gdańsku pada (11°C)." }]);
  const runner = new AgentRunner({ store, llm, tools: [weatherTool(log)] });
  const run = newRun({ tenantId: "t1", goal: "Should I take an umbrella when I go out in Gdansk today?" });
  await store.create(run);
  const done = await runToEnd(runner, store, run.id);
  assert.deepEqual(log, ["Gdańsk"]);
  assert.equal(done.status, "COMPLETED");
  assert.match(done.result!.summary, /parasol/);
  assert.equal(llm.requests[0].tools?.some((t) => t.function.name === "weather_current"), true, "model receives tools on the first turn");
  assert.ok(llm.requests.every((r) => r.maxOutputTokens > 0 && r.maxOutputTokens <= 16000), "every call is token-bounded");
});

test("multi-step run with workspace files and a document; finish gate rejects then accepts", async () => {
  const store = new MemoryRunStore();
  const llm = scriptedLlm([
    call("workspace_write", { path: "PLAN.md", content: "1. spec\n2. schema\n3. pdf" }),
    call("workspace_write", { path: "spec.md", content: "# Spec\nRezerwacje stolików" }),
    finish("too early", [["Specyfikacja", true, "workspace:spec.md"], ["Schemat bazy", false, "todo"]]),
    call("workspace_write", { path: "schema.sql", content: "create table reservations(id uuid primary key);" }),
    call("document_create", { title: "Plan wdrożenia", text: "Etap 1...\nEtap 2...", format: "pdf" }),
    finish("done", [["Specyfikacja", true, "workspace:spec.md"], ["Schemat bazy", true, "workspace:schema.sql"]]),
  ]);
  const runner = new AgentRunner({ store, llm });
  const run = newRun({ tenantId: "t1", goal: "Zbuduj specyfikację i schemat", acceptanceCriteria: ["Specyfikacja", "Schemat bazy"] });
  await store.create(run);
  const done = await runToEnd(runner, store, run.id);
  assert.equal(done.status, "COMPLETED", done.error ?? "");
  assert.deepEqual(Object.keys(done.workspace).sort(), ["PLAN.md", "schema.sql", "spec.md"]);
  assert.equal(done.artifacts.length, 1);
  assert.equal(done.artifacts[0].type, "file");
  assert.ok(done.steps.some((s) => s.toolName === "finish" && s.toolStatus === "REJECTED"), "first finish was rejected");
  const pdf = Buffer.from(done.artifacts[0].dataUrl!.split(",")[1], "base64").toString("latin1");
  assert.match(pdf, /\(Plan wdrozenia\) Tj/, "PDF text is readable (diacritics transliterated)");
  assert.match(pdf, /\nstartxref\n\d+\n%%EOF$/, "PDF has a real xref trailer");
});

test("finish citing a non-existent workspace file is rejected", async () => {
  const store = new MemoryRunStore();
  const llm = scriptedLlm([finish("x", [["Spec", true, "workspace:missing.md"]]), finish("x", [["Spec", true, "described in reply"]])]);
  const run = newRun({ tenantId: "t1", goal: "g", acceptanceCriteria: ["Spec"] });
  await store.create(run);
  const done = await runToEnd(new AgentRunner({ store, llm }), store, run.id);
  assert.equal(done.status, "COMPLETED");
  assert.match(done.steps.find((s) => s.toolStatus === "REJECTED")!.summary, /missing\.md/);
});

test("side-effect tool pauses for approval; rejection is reported honestly and the run continues", async () => {
  const store = new MemoryRunStore();
  const llm = scriptedLlm([
    call("send_email", { to: "jan@example.com", subject: "Oferta", body: "..." }),
    (req) => {
      const last = req.messages.at(-1) as ChatMessage;
      assert.equal(last.role, "tool");
      assert.match((last as { content: string }).content, /HUMAN_REJECTED/);
      return { content: "Mail NIE został wysłany — odrzucono go w akceptacji." };
    },
  ]);
  const runner = new AgentRunner({ store, llm });
  const run = newRun({ tenantId: "t1", goal: "Wyślij maila do Jana z ofertą" });
  await store.create(run);
  await runner.drainQueue();
  const paused = (await store.get(run.id))!;
  assert.equal(paused.status, "WAITING_APPROVAL");
  assert.equal(paused.pendingApproval?.toolName, "send_email");
  await assert.rejects(decideApproval(store, run.id, "other-tenant", "REJECTED"), /RUN_NOT_FOUND/);
  await decideApproval(store, run.id, "t1", "REJECTED");
  const done = await runToEnd(runner, store, run.id);
  assert.equal(done.status, "COMPLETED");
  assert.match(done.result!.summary, /NIE został wysłany/);
});

test("approved side effect executes the tool; missing integration is surfaced, not faked", async () => {
  const store = new MemoryRunStore();
  const llm = scriptedLlm([
    call("send_email", { to: "a@b.c", subject: "s", body: "b" }),
    (req) => ({ content: "Nie wysłano: " + String((req.messages.at(-1) as { content: string }).content) }),
    { content: "Nie wysłano maila: EMAIL_INTEGRATION_NOT_CONFIGURED. Potrzebna integracja pocztowa." },
  ]);
  const runner = new AgentRunner({ store, llm });
  const run = newRun({ tenantId: "t1", goal: "send" });
  await store.create(run);
  await runner.drainQueue();
  await decideApproval(store, run.id, "t1", "APPROVED");
  const done = await runToEnd(runner, store, run.id);
  assert.match(done.result!.summary, /EMAIL_INTEGRATION_NOT_CONFIGURED/);
  assert.ok(done.steps.some((s) => s.toolName === "send_email" && s.toolStatus === "FAILED"));
});

test("budget exhaustion stops the run; resume with extra budget continues to completion", async () => {
  const store = new MemoryRunStore();
  const llm = scriptedLlm([
    call("workspace_write", { path: "a.md", content: "a" }),
    call("workspace_write", { path: "b.md", content: "b" }),
    finish("ok", [["A", true, "workspace:a.md"]]),
  ]);
  const runner = new AgentRunner({ store, llm });
  const run = newRun({ tenantId: "t1", goal: "g", acceptanceCriteria: ["A"], budget: { maxSteps: 2 } });
  await store.create(run);
  const stopped = await runToEnd(runner, store, run.id);
  assert.equal(stopped.status, "BUDGET_EXHAUSTED");
  assert.equal(stopped.error, "MAX_STEPS");
  await resumeRun(store, run.id, "t1", { maxSteps: 5 });
  const done = await runToEnd(runner, store, run.id);
  assert.equal(done.status, "COMPLETED");
  assert.equal(done.usage.steps, 3);
});

test("crash recovery: a run with an unanswered tool call resumes by executing it, without a new LLM turn", async () => {
  const store = new MemoryRunStore(); const log: string[] = [];
  const run = newRun({ tenantId: "t1", goal: "weather" });
  const crashed = {
    ...run, status: "RUNNING" as const, lease: { owner: "dead-worker", expiresAt: Date.now() - 1 },
    messages: [{ role: "system" as const, content: "s" }, { role: "user" as const, content: "weather" }, { role: "assistant" as const, content: null, tool_calls: [{ id: "x1", type: "function" as const, function: { name: "weather_current", arguments: "{\"city\":\"Kraków\"}" } }] }],
    usage: { ...run.usage, steps: 1 },
  };
  await store.create(crashed);
  const llm = scriptedLlm([{ content: "W Krakowie 11°C." }]);
  const done = await runToEnd(new AgentRunner({ store, llm, tools: [weatherTool(log)] }), store, run.id);
  assert.deepEqual(log, ["Kraków"], "pending tool executed exactly once");
  assert.equal(llm.requests.length, 1, "only the follow-up turn hit the LLM");
  assert.equal(done.status, "COMPLETED");
});

test("a live lease blocks a second worker; an expired lease can be taken over", async () => {
  const store = new MemoryRunStore();
  await store.create(newRun({ tenantId: "t1", goal: "g" }));
  const now = Date.now();
  assert.ok(await store.claimNext("w1", 60_000, now));
  assert.equal(await store.claimNext("w2", 60_000, now + 1000), null);
  assert.equal((await store.claimNext("w2", 60_000, now + 61_000))?.lease?.owner, "w2");
});

test("transient LLM errors are retried by the loop; a fatal error fails the run", async () => {
  const store = new MemoryRunStore();
  const llm = scriptedLlm([new LlmError("LLM_HTTP_429", true), new LlmError("LLM_HTTP_503", true), { content: "ok" }]);
  const run = newRun({ tenantId: "t1", goal: "g" });
  await store.create(run);
  const done = await runToEnd(new AgentRunner({ store, llm }), store, run.id);
  assert.equal(done.status, "COMPLETED");

  const store2 = new MemoryRunStore();
  const run2 = newRun({ tenantId: "t1", goal: "g" });
  await store2.create(run2);
  const failed = await runToEnd(new AgentRunner({ store: store2, llm: scriptedLlm([new LlmError("LLM_HTTP_401", false)]) }), store2, run2.id);
  assert.equal(failed.status, "FAILED");
  assert.match(failed.error!, /401/);
});

test("text-only replies on a task with criteria are nudged, then fail instead of looping forever", async () => {
  const store = new MemoryRunStore();
  const run = newRun({ tenantId: "t1", goal: "g", acceptanceCriteria: ["A"] });
  await store.create(run);
  const done = await runToEnd(new AgentRunner({ store, llm: scriptedLlm([{ content: "a" }, { content: "b" }, { content: "c" }]) }), store, run.id);
  assert.equal(done.status, "FAILED");
  assert.equal(done.error, "AGENT_STOPPED_WITHOUT_FINISH");
});

test("cancel stops a queued run and is tenant-scoped", async () => {
  const store = new MemoryRunStore();
  const run = newRun({ tenantId: "t1", goal: "g" });
  await store.create(run);
  await assert.rejects(cancelRun(store, run.id, "t2"), /RUN_NOT_FOUND/);
  assert.equal((await cancelRun(store, run.id, "t1")).status, "CANCELLED");
  assert.equal(await store.claimNext("w", 1000), null);
});

test("FileRunStore persists across instances and enforces versions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-runs-"));
  try {
    const a = new FileRunStore(dir);
    const run = newRun({ tenantId: "t1", goal: "g" });
    await a.create(run);
    const claimed = await a.claimNext("w1", 60_000);
    assert.equal(claimed?.status, "RUNNING");
    const b = new FileRunStore(dir);
    assert.equal((await b.get(run.id))?.version, 1);
    await assert.rejects(b.save(run), VersionConflictError);
    assert.equal((await b.list("t1")).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("context compaction stubs old tool outputs but keeps goal and recent turns", () => {
  const big = "x".repeat(50_000);
  const messages: ChatMessage[] = [{ role: "system", content: "s" }, { role: "user", content: "goal" }];
  for (let i = 0; i < 10; i++) messages.push({ role: "assistant", content: null, tool_calls: [{ id: "t" + i, type: "function", function: { name: "x", arguments: "{}" } }] }, { role: "tool", tool_call_id: "t" + i, content: big });
  const compacted = compactMessages(messages);
  assert.equal(compacted[1].content, "goal");
  assert.match(String(compacted[3].content), /compacted/);
  assert.equal(compacted.at(-1)!.content, big);
});

test("OpenAI-compatible client bounds output, retries 429 and does not retry 400", async () => {
  const bodies: Record<string, unknown>[] = [];
  const statuses = [429, 200];
  const client = createOpenAiCompatibleClient({
    baseUrl: "https://llm.test/v1", apiKey: "k", model: "m", priceInPerMTok: 3, priceOutPerMTok: 15, sleep: async () => {},
    fetchImpl: (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      const status = statuses.shift() ?? 200;
      return new Response(status === 200 ? JSON.stringify({ choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 1000, completion_tokens: 100 } }) : "{}", { status });
    }) as typeof fetch,
  });
  const res = await client.complete({ messages: [{ role: "user", content: "x" }], maxOutputTokens: 321 });
  assert.equal(res.message.content, "hi");
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].max_tokens, 321);
  assert.ok(Math.abs(res.usage.costUsd - 0.0045) < 1e-9);

  const bad = createOpenAiCompatibleClient({ baseUrl: "https://llm.test/v1", apiKey: "k", model: "m", sleep: async () => {}, fetchImpl: (async () => new Response("{}", { status: 400 })) as typeof fetch });
  let calls = 0;
  const counting = { complete: (r: LlmRequest) => { calls++; return bad.complete(r); } };
  await assert.rejects(counting.complete({ messages: [], maxOutputTokens: 10 }), /LLM_HTTP_400/);
  assert.equal(calls, 1);
});

test("builtin tools: workspace path traversal is blocked", async () => {
  const write = builtinTools.find((t) => t.name === "workspace_write")!;
  await assert.rejects(write.execute({ path: "../etc/passwd", content: "x" }, { run: newRun({ tenantId: "t", goal: "g" }) }), /INVALID_PATH/);
});

test("tenant resolution maps each API key to its own tenant (regression for Bearer regex bug)", () => {
  const prev = { map: process.env.CORE_ENGINE_API_KEYS_JSON, id: process.env.CORE_ENGINE_TENANT_ID };
  process.env.CORE_ENGINE_API_KEYS_JSON = JSON.stringify({ acme: "secret-acme", beta: "secret-beta" });
  process.env.CORE_ENGINE_TENANT_ID = "default-tenant";
  try {
    const key = (k: string) => resolveTenant(new Request("https://x", { headers: { authorization: "Bearer " + k } })).tenantKey;
    assert.equal(key("secret-acme"), "acme");
    assert.equal(key("secret-beta"), "beta");
  } finally {
    if (prev.map === undefined) delete process.env.CORE_ENGINE_API_KEYS_JSON; else process.env.CORE_ENGINE_API_KEYS_JSON = prev.map;
    if (prev.id === undefined) delete process.env.CORE_ENGINE_TENANT_ID; else process.env.CORE_ENGINE_TENANT_ID = prev.id;
  }
});

test("output truncated at max_tokens is not executed; the model is told to split work and recovers", async () => {
  const store = new MemoryRunStore();
  const llm = scriptedLlm([
    { ...call("workspace_write", { path: "big.ts", content: "partial" }), finishReason: "length" } as LlmResponse["message"],
    (req) => { assert.match(String((req.messages.at(-1) as { content: string }).content), /cut off at the output limit/); return call("workspace_write", { path: "a.ts", content: "ok" }); },
    finish("done", [["File", true, "workspace:a.ts"]]),
  ]);
  const run = newRun({ tenantId: "t1", goal: "g", acceptanceCriteria: ["File"] });
  await store.create(run);
  const done = await runToEnd(new AgentRunner({ store, llm }), store, run.id);
  assert.equal(done.status, "COMPLETED");
  assert.deepEqual(Object.keys(done.workspace), ["a.ts"], "truncated tool call was never executed");
});

test("without criteria, a text reply right after a failed tool does not complete the run", async () => {
  const store = new MemoryRunStore();
  const failing: AgentTool = { name: "website_build", description: "x", parameters: { type: "object" }, sideEffect: false, async execute() { return { status: "FAILED", output: { error: "aborted" } }; } };
  const llm = scriptedLlm([
    call("website_build", { brief: "b" }),
    { content: "Generator zawiódł, napiszę stronę sam." },
    (req) => { assert.match(String((req.messages.at(-1) as { content: string }).content), /last tool call failed/); return call("workspace_write", { path: "index.html", content: "<html></html>" }); },
    { content: "Strona zapisana w workspace: index.html." },
  ]);
  const run = newRun({ tenantId: "t1", goal: "landing page" });
  await store.create(run);
  const done = await runToEnd(new AgentRunner({ store, llm, tools: [failing, ...builtinTools] }), store, run.id);
  assert.equal(done.status, "COMPLETED");
  assert.ok("index.html" in done.workspace);
  assert.match(done.result!.summary, /index\.html/);
});

test("announcement text between tool batches does not count toward the stop limit", async () => {
  const store = new MemoryRunStore();
  const llm = scriptedLlm([
    { content: "Zaczynam od planu." },
    call("workspace_write", { path: "PLAN.md", content: "1" }),
    { content: "Teraz API." },
    { content: "Piszę API." },
    call("workspace_write", { path: "api.ts", content: "x" }),
    finish("ok", [["API", true, "workspace:api.ts"]]),
  ]);
  const run = newRun({ tenantId: "t1", goal: "g", acceptanceCriteria: ["API"] });
  await store.create(run);
  const done = await runToEnd(new AgentRunner({ store, llm }), store, run.id);
  assert.equal(done.status, "COMPLETED");
});

test("workspace_read pages through large files without hitting the tool-output clip", async () => {
  const read = builtinTools.find((t) => t.name === "workspace_read")!;
  const run = { ...newRun({ tenantId: "t", goal: "g" }), workspace: { "site/index.html": "a".repeat(12_000) } };
  const first = (await read.execute({ path: "site/index.html" }, { run })).output as { nextOffset: number; content: string; totalChars: number };
  assert.equal(first.content.length, 5000);
  assert.equal(first.nextOffset, 5000);
  const last = (await read.execute({ path: "site/index.html", offset: 10_000 }, { run })).output as { nextOffset: number | null; content: string };
  assert.equal(last.content.length, 2000);
  assert.equal(last.nextOffset, null);
});

test("SupabaseRunStore normalises a project URL pasted with /rest/v1/", async () => {
  const { SupabaseRunStore } = await import("@/lib/agent-loop/store");
  const urls: string[] = [];
  const fetchImpl = (async (u: string | URL) => { urls.push(String(u)); return new Response("[]", { status: 200, headers: { "content-type": "application/json" } }); }) as typeof fetch;
  for (const url of ["https://x.supabase.co", "https://x.supabase.co/", "https://x.supabase.co/rest/v1/", " https://x.supabase.co/rest/v1 "]) {
    await new SupabaseRunStore({ url, key: "k", fetchImpl }).get("run-1");
  }
  for (const u of urls) assert.match(u, /^https:\/\/x\.supabase\.co\/rest\/v1\/ce_agent_jobs\?/);
});
