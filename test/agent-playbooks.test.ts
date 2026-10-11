import test from "node:test";
import assert from "node:assert/strict";
import { PLAYBOOKS, playbookCatalog, renderPlaybook } from "@/lib/agent-loop/playbooks";
import { MemoryRunStore, SupabaseRunStore } from "@/lib/agent-loop/store";
import { AgentRunner, newRun } from "@/lib/agent-loop/runner";
import { builtinTools } from "@/lib/agent-loop/tools";
import { describeLlmConfig, createLlmClientFromEnv } from "@/lib/agent-loop/llm";
import { normaliseCapabilities, type AgentRun, type AgentTool } from "@/lib/agent-loop/contracts";
import { sandboxEnv } from "@/lib/agent-loop/sandbox";

test("every playbook renders with its required inputs and leaves no placeholders", () => {
  assert.ok(PLAYBOOKS.length >= 6);
  const ids = new Set<string>();
  for (const p of PLAYBOOKS) {
    assert.ok(!ids.has(p.id), "duplicate id " + p.id); ids.add(p.id);
    const inputs = Object.fromEntries(p.inputs.map((f) => [f.key, "x"]));
    const r = renderPlaybook(p.id, inputs);
    assert.doesNotMatch(r.goal + r.acceptanceCriteria.join(""), /\{\{|\}\}/, p.id);
    assert.ok(r.acceptanceCriteria.length >= 2, p.id);
    for (const k of p.goal.match(/\{\{(\w+)\}\}/g) ?? []) assert.ok(p.inputs.some((f) => `{{${f.key}}}` === k), `${p.id}: ${k} has no input`);
  }
});

test("renderPlaybook validates required fields, length, and strips template braces from user text", () => {
  assert.throws(() => renderPlaybook("nope", {}), /INVALID_PLAYBOOK/);
  assert.throws(() => renderPlaybook("agent-blueprint", { name: "A" }), /INVALID_PLAYBOOK_INPUT:job/);
  assert.throws(() => renderPlaybook("agent-blueprint", { name: "A".repeat(500), job: "x" }), /INVALID_PLAYBOOK_INPUT:name/);
  const r = renderPlaybook("agent-blueprint", { name: "Bot {{job}}", job: "rezerwacje" });
  assert.match(r.goal, /"Bot job"/);
  assert.match(r.goal, /Dostępne systemy i dane: \(nie podano\)/);
  assert.deepEqual(r.requires, []);
});

test("large pasted data goes to run context, not into the goal", () => {
  const csv = "d,v\n" + "2026-01-01,1\n".repeat(500);
  const r = renderPlaybook("data-insights", { question: "co spada?", data: csv });
  assert.equal(r.context, csv.trim());
  assert.ok(r.goal.length < 2000);
});

test("sandbox is required only when the playbook allows it and the operator asks", () => {
  assert.deepEqual(renderPlaybook("code-module", { language: "Python", feature: "x" }, { sandbox: true }).requires, ["sandbox"]);
  assert.deepEqual(renderPlaybook("code-module", { language: "Python", feature: "x" }).requires, []);
  assert.deepEqual(renderPlaybook("ceo-plan", { objective: "x" }, { sandbox: true }).requires, []);
  assert.ok(playbookCatalog().every((p) => !("goal" in p) && !("criteria" in p)), "templates stay server-side");
});

test("capabilities are normalised to the known set", () => {
  assert.deepEqual(normaliseCapabilities(["sandbox", "sandbox", "root", 1]), ["sandbox"]);
  assert.deepEqual(normaliseCapabilities("sandbox"), []);
  assert.equal(newRun({ tenantId: "t", goal: "g", requires: ["gpu"] }).requires, undefined);
});

test("a worker never claims runs that need a capability it lacks; a capable worker does (oldest first)", async () => {
  const store = new MemoryRunStore();
  const needsSandbox = newRun({ tenantId: "t", goal: "code", requires: ["sandbox"] });
  await store.create({ ...needsSandbox, createdAt: "2026-01-01T00:00:00.000Z" });
  const plain = newRun({ tenantId: "t", goal: "doc" });
  await store.create({ ...plain, createdAt: "2026-01-02T00:00:00.000Z" });
  const web = await store.claimNext("web", 60_000, Date.now(), []);
  assert.equal(web?.id, plain.id, "web worker skips the sandbox run");
  assert.equal(await store.claimNext("web", 60_000, Date.now(), []), null);
  const local = await store.claimNext("pc", 60_000, Date.now(), ["sandbox"]);
  assert.equal(local?.id, needsSandbox.id);
});

test("runner advertises sandbox only when it has run_command", () => {
  const llm = { model: "m", complete: async () => { throw new Error("unused"); } };
  const fakeRun: AgentTool = { name: "run_command", description: "", parameters: {}, sideEffect: false, execute: async () => ({ status: "EXECUTED", output: null }) };
  assert.deepEqual(new AgentRunner({ store: new MemoryRunStore(), llm, tools: builtinTools }).capabilities, []);
  assert.deepEqual(new AgentRunner({ store: new MemoryRunStore(), llm, tools: [...builtinTools, fakeRun] }).capabilities, ["sandbox"]);
});

test("Supabase store uses the v2 claim with capabilities and falls back to v1 + hand-back before the migration", async () => {
  const calls: Array<{ url: string; body: unknown; method: string }> = [];
  const run: AgentRun = { ...newRun({ tenantId: "t", goal: "code", requires: ["sandbox"] }), status: "RUNNING", version: 1 };
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = (async (u: string | URL, init?: RequestInit) => {
    const url = String(u); const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body, method: init?.method ?? "GET" });
    if (url.endsWith("/rpc/ce_agent_job_claim_v2")) return respond(404, { code: "PGRST202", message: "Could not find the function" });
    if (url.endsWith("/rpc/ce_agent_job_claim")) return respond(200, [{ data: run }]);
    if (init?.method === "PATCH") return respond(200, [{ data: { ...body.data } }]);
    return respond(200, []);
  }) as typeof fetch;
  const store = new SupabaseRunStore({ url: "https://x.supabase.co", key: "k", fetchImpl });
  assert.equal(await store.claimNext("web", 60_000, Date.now(), []), null, "v1 claimed a sandbox run: it must be handed back");
  const patch = calls.find((c) => c.method === "PATCH");
  assert.equal((patch?.body as { status: string }).status, "QUEUED");
  assert.deepEqual((calls[0].body as { p_capabilities: string[] }).p_capabilities, []);
  calls.length = 0;
  await store.claimNext("web", 60_000, Date.now(), []);
  assert.ok(!calls.some((c) => c.url.endsWith("_v2")), "v2 is not retried once known to be missing");
});

test("Supabase rows carry `requires` only when set (backward compatible insert)", async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const fetchImpl = (async (_u: string | URL, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body))); return new Response("", { status: 201 }); }) as typeof fetch;
  const store = new SupabaseRunStore({ url: "https://x.supabase.co", key: "k", fetchImpl });
  await store.create(newRun({ tenantId: "t", goal: "a" }));
  await store.create(newRun({ tenantId: "t", goal: "b", requires: ["sandbox"] }));
  assert.ok(!("requires" in bodies[0]));
  assert.deepEqual(bodies[1].requires, ["sandbox"]);
});

test("LLM config is explicit: an Anthropic model id never silently goes to OpenRouter", () => {
  assert.deepEqual(describeLlmConfig({ ANTHROPIC_API_KEY: "a", AGENT_LLM_MODEL: "claude-sonnet-5-5" }), { configured: true, provider: "anthropic", model: "claude-sonnet-5-5", issue: null });
  const mismatch = describeLlmConfig({ OPENROUTER_API_KEY: "o", AGENT_LLM_MODEL: "claude-sonnet-5-5" });
  assert.equal(mismatch.configured, false);
  assert.match(mismatch.issue ?? "", /ANTHROPIC_API_KEY/);
  assert.equal(createLlmClientFromEnv({ OPENROUTER_API_KEY: "o", AGENT_LLM_MODEL: "claude-sonnet-5-5" }), null);
  assert.equal(describeLlmConfig({ OPENROUTER_API_KEY: "o" }).model, "openai/gpt-5-mini");
  assert.equal(describeLlmConfig({}).configured, false);
  assert.equal(describeLlmConfig({ AGENT_LLM_BASE_URL: "http://x", AGENT_LLM_API_KEY: "k", AGENT_LLM_MODEL: "m" }).provider, "custom");
});

test("sandbox environment carries no secrets on any platform", () => {
  const env = sandboxEnv("/tmp/x", { PATH: "/bin", ANTHROPIC_API_KEY: "secret", SUPABASE_SERVICE_ROLE_KEY: "s", SystemRoot: "C:\\Windows" });
  assert.ok(!Object.values(env).includes("secret") && !Object.values(env).includes("s"));
  assert.equal(env.HOME, "/tmp/x");
});
