import test from "node:test";
import assert from "node:assert/strict";
import { LocalProcessSandbox, createRunCommandTool, sandboxToolFromEnv } from "@/lib/agent-loop/sandbox";
import { AgentRunner, newRun } from "@/lib/agent-loop/runner";
import { MemoryRunStore } from "@/lib/agent-loop/store";
import { builtinTools } from "@/lib/agent-loop/tools";
import type { LlmClient, LlmRequest, LlmResponse } from "@/lib/agent-loop/llm";

const sbx = new LocalProcessSandbox();
const base = { files: {}, timeoutMs: 10_000, network: true };

test("runs an allow-listed command against workspace files and returns exit code + output", async () => {
  const r = await sbx.run({ ...base, command: "python3", args: ["main.py"], files: { "main.py": "print(6*7)" } });
  assert.equal(r.exitCode, 0);
  assert.match(r.stdout, /42/);
});

test("rejects executables outside the allow-list (no shell)", async () => {
  await assert.rejects(sbx.run({ ...base, command: "bash", args: ["-c", "echo hi"] }), /COMMAND_NOT_ALLOWED/);
  // shell metacharacters are passed as literal argv, not interpreted
  const r = await sbx.run({ ...base, command: "node", args: ["-e", "console.log(process.argv[1])", "$(whoami); rm -rf /"] });
  assert.match(r.stdout, /\$\(whoami\); rm -rf \//);
});

test("secrets in the parent environment never reach sandboxed code", async () => {
  process.env.SUPER_SECRET_FOR_TEST = "leak-me";
  try {
    const r = await sbx.run({ ...base, command: "node", args: ["-e", "console.log(JSON.stringify(Object.keys(process.env)))"] });
    assert.doesNotMatch(r.stdout, /SUPER_SECRET_FOR_TEST|ANTHROPIC|SUPABASE/);
  } finally { delete process.env.SUPER_SECRET_FOR_TEST; }
});

test("timeouts kill the whole process group", async () => {
  const started = Date.now();
  const r = await sbx.run({ ...base, command: "node", args: ["-e", "require('child_process').spawn('sleep',['30']);setInterval(()=>{},1000)"], timeoutMs: 1500 });
  assert.equal(r.timedOut, true);
  assert.ok(Date.now() - started < 6000);
});

test("files created or modified by the command are synced back; unchanged and cache files are not", async () => {
  const r = await sbx.run({ ...base, command: "python3", args: ["-c", "open('out.txt','w').write('generated'); import os; os.makedirs('__pycache__', exist_ok=True); open('__pycache__/x.pyc','w').write('x')"], files: { "keep.md": "same" } });
  assert.deepEqual(r.changedFiles, { "out.txt": "generated" });
});

test("network can be disabled when the host supports namespaces", { skip: process.platform !== "linux" }, async () => {
  const r = await sbx.run({ ...base, network: false, command: "node", args: ["-e", "require('dns').lookup('example.com',(e)=>{console.log(e?'NO_NET':'NET');})"] });
  if (r.isolation.networkDisabled) assert.match(r.stdout, /NO_NET/);
  else assert.equal(r.isolation.networkDisabled, false, "reported honestly when isolation is unavailable");
});

test("sandbox tool is off unless AGENT_SANDBOX=local", () => {
  assert.equal(sandboxToolFromEnv({}), null);
  assert.equal(sandboxToolFromEnv({ AGENT_SANDBOX: "local" })?.name, "run_command");
});

test("agent loop: write code + failing test → run → fix → run green → finish", async () => {
  const store = new MemoryRunStore();
  const tool = createRunCommandTool(sbx);
  const outputs: string[] = [];
  const call = (id: string, name: string, args: unknown) => ({ content: null, tool_calls: [{ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } }] });
  const test_py = "import unittest\nfrom calc import add\n\nclass T(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 3), 5)\n";
  const turns: Array<(r: LlmRequest) => LlmResponse["message"]> = [
    () => call("a", "workspace_write", { path: "calc.py", content: "def add(a, b):\n    return a - b\n" }),
    () => call("b", "workspace_write", { path: "test_calc.py", content: test_py }),
    () => call("c", "run_command", { command: "python3", args: ["-m", "unittest", "-q"] }),
    (r) => { outputs.push(String((r.messages.at(-1) as { content: string }).content)); return call("d", "workspace_write", { path: "calc.py", content: "def add(a, b):\n    return a + b\n" }); },
    () => call("e", "run_command", { command: "python3", args: ["-m", "unittest", "-q"] }),
    (r) => { outputs.push(String((r.messages.at(-1) as { content: string }).content)); return call("f", "finish", { summary: "add() fixed, tests green", criteria: [{ criterion: "Tests pass", met: true, evidence: "python3 -m unittest -q → exit 0, workspace:test_calc.py" }] }); },
  ];
  const llm: LlmClient = { model: "scripted", async complete(req) { const t = turns.shift()!; return { message: t(req), usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 }, model: "s", finishReason: null }; } };
  const run = newRun({ tenantId: "t", goal: "add() with passing tests", acceptanceCriteria: ["Tests pass"] });
  await store.create(run);
  await new AgentRunner({ store, llm, tools: [...builtinTools, tool] }).drainQueue();
  const done = (await store.get(run.id))!;
  assert.equal(done.status, "COMPLETED", done.error ?? "");
  assert.match(outputs[0], /"exitCode":1/, "first run fails");
  assert.match(outputs[1], /"exitCode":0/, "second run passes");
  assert.match(done.workspace["calc.py"], /a \+ b/);
});
