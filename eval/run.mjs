// Core Engine eval runner.
// Usage: EVAL_MODE=mock|anthropic node eval/run.mjs [T01,T05,...]
// Starts the eval proxy and a production-mode Next server (requires `npm run build`),
// runs tasks sequentially, attributes provider calls to each task and writes eval/out/report-<mode>.{json,md}.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const MODE = process.env.EVAL_MODE || "mock";
const OUT = join(here, "out");
const APP_PORT = Number(process.env.EVAL_APP_PORT || 4410);
const PROXY_PORT = Number(process.env.EVAL_PROXY_PORT || 4500);
const API_KEY = "eval-local-key";
const TASK_TIMEOUT_MS = Number(process.env.EVAL_TASK_TIMEOUT_MS || 300000);
mkdirSync(OUT, { recursive: true });

const suite = JSON.parse(readFileSync(join(here, "tasks.json"), "utf8"));
const only = (process.argv[2] || "").split(",").filter(Boolean);
const tasks = suite.tasks.filter((t) => !only.length || only.includes(t.id));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function start(cmd, args, env, tag) {
  const child = spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  const log = [];
  child.stdout.on("data", (d) => log.push(String(d)));
  child.stderr.on("data", (d) => log.push(String(d)));
  child.on("exit", (code) => log.push(`[${tag}] exited ${code}`));
  return { child, log };
}

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await sleep(300);
  }
  throw new Error("NOT_READY " + url);
}

const proxyUrl = `http://127.0.0.1:${PROXY_PORT}`;
const appUrl = `http://127.0.0.1:${APP_PORT}`;

async function post(path, body, auth = false) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);
  try {
    const r = await fetch(appUrl + path, {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + API_KEY } : {}) },
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json, ms: Date.now() - started };
  } catch (error) {
    return { status: 0, json: { error: String(error) }, ms: Date.now() - started };
  } finally { clearTimeout(timer); }
}

const LOOP_TOOLS = { weather_current: "multitask.weather.current", website_build: "multitask.website.build", document_create: "multitask.document.create", data_analyze: "multitask.data.analyze" };
function normalizeTool(name) {
  if (!name) return null;
  if (name.startsWith("multitask_")) return name.replace(/^multitask_/, "multitask.").replace(/_/g, ".");
  return LOOP_TOOLS[name] || name;
}

async function get(path) {
  const r = await fetch(appUrl + path, { headers: { authorization: "Bearer " + API_KEY } });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

// Durable loop path: enqueue → poll → (approve/reject) → poll → map to the legacy result shape for shared checks.
async function runLoop(task) {
  const started = Date.now();
  const created = await post("/api/agent/runs", { goal: task.task, context: task.documentContext, acceptanceCriteria: task.criteria || [], budget: { maxSteps: 30, maxCostUsd: Number(process.env.EVAL_RUN_COST_CAP || 1) } }, true);
  const id = created.json?.run?.id;
  if (!id) return { status: created.status, json: { error: created.json?.error }, ms: Date.now() - started };
  let run, sawApproval = false;
  const deadline = started + TASK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(MODE === "mock" ? 100 : 1500);
    run = (await get(`/api/agent/runs/${id}`)).json.run;
    if (run?.status === "WAITING_APPROVAL") {
      sawApproval = true;
      await post(`/api/agent/runs/${id}`, { action: task.approvalDecision === "approve" ? "approve" : "reject" }, true);
      continue;
    }
    if (run && ["COMPLETED", "FAILED", "BUDGET_EXHAUSTED", "CANCELLED"].includes(run.status)) break;
  }
  const full = (await get(`/api/agent/runs/${id}?messages=1`)).json.run;
  const commandOutputs = (full?.messages || []).filter((m) => m.role === "tool" && m.content.includes('"exitCode"')).map((m) => { try { return JSON.parse(m.content).output; } catch { return null; } }).filter(Boolean);
  const first = run?.artifacts?.[0];
  const artifact = first ? (await get(`/api/agent/runs/${id}?artifact=${first.id}`)).json.artifact : null;
  const executed = (run?.steps || []).filter((st) => st.kind === "tool" && st.toolStatus === "EXECUTED" && st.toolName !== "finish");
  const nonWorkspace = executed.find((st) => !st.toolName.startsWith("workspace_"));
  const executedTool = normalizeTool(nonWorkspace?.toolName);
  return {
    status: created.status, ms: Date.now() - started,
    json: {
      runId: id, status: created.json.run.status, pollUrl: created.json.pollUrl, finalStatus: run?.status, runError: run?.error,
      reply: run?.result?.summary || "", requiresApproval: sawApproval,
      artifact: artifact ? { type: artifact.type, status: "EXECUTED", provider: artifact.provider, html: artifact.type === "website" ? artifact.content : undefined, dataUrl: artifact.dataUrl } : undefined,
      operationalRun: { tool: executedTool ? { id: executedTool } : undefined },
      evidence: { toolRuns: executed.map((st) => ({ tool: normalizeTool(st.toolName), status: "EXECUTED" })) },
      execution: "DURABLE_LOOP", intelligence: { mode: "loop" },
      workspace: Object.keys(run?.workspace || {}), usage: run?.usage,
      workspaceFiles: full?.workspaceFiles || {}, commandOutputs,
    },
  };
}

function decodeArtifactText(artifact) {
  if (!artifact?.dataUrl) return "";
  try { return Buffer.from(artifact.dataUrl.split(",")[1] || "", "base64").toString("latin1"); } catch { return ""; }
}

function evaluate(task, res, calls) {
  const j = res.json || {};
  const reply = String(j.reply || j.preview?.answer || "");
  const artifact = j.artifact;
  const toolRuns = j.evidence?.toolRuns || [];
  const executedTool = j.operationalRun?.tool?.id || toolRuns[0]?.tool || null;
  const chat = calls.filter((c) => c.kind === "chat");
  const modelTool = normalizeTool(chat.find((c) => c.toolCall && c.toolCall !== "workspace_write")?.toolCall);
  const fileText = decodeArtifactText(artifact);
  const results = task.checks.map((c) => {
    let pass = false, detail = "";
    switch (c.type) {
      case "replyIncludes": pass = c.any.some((v) => reply.toLowerCase().includes(v.toLowerCase())); detail = reply.slice(0, 160); break;
      case "replyIncludesAll": pass = c.values.every((v) => reply.includes(v)); break;
      case "maxLlmCalls": pass = chat.length <= c.value; detail = `${chat.length} calls`; break;
      case "noArtifact": pass = !artifact; detail = artifact ? `artifact=${artifact.type}` : ""; break;
      case "tool": pass = executedTool === c.value; detail = `executed=${executedTool}`; break;
      case "toolMatchesModel": pass = !modelTool || modelTool === executedTool; detail = `model=${modelTool} executed=${executedTool}`; break;
      case "artifactType": pass = artifact?.type === c.value && artifact?.status === "EXECUTED"; detail = `artifact=${artifact?.type || "none"}/${artifact?.status || "-"}`; break;
      case "htmlIncludesAll": { const h = String(artifact?.html || "").toLowerCase(); pass = c.values.every((v) => h.includes(v)); detail = `provider=${artifact?.provider}`; break; }
      case "fileIsNotJustPrompt": pass = Boolean(fileText) && !fileText.includes(task.task.slice(0, 40)); detail = fileText ? "pdf contains the raw prompt=" + fileText.includes(task.task.slice(0, 40)) : "no file"; break;
      case "fileIncludes": pass = fileText.includes(c.value); break;
      case "minToolRuns": pass = toolRuns.length >= c.value; detail = `${toolRuns.length} tool runs`; break;
      case "asyncRunSupported": pass = Boolean(j.runId && (j.status === "QUEUED" || j.status === "RUNNING") && j.pollUrl); detail = `sync response in ${res.ms} ms`; break;
      case "noFalseClaim": pass = !/(wysłałem|wysłano|został wysłany|zostal wyslany|\bsent\b)/i.test(reply) || /(nie (został|zostało|zostal|wysłano|wysłałem|mogę)|not (been )?sent|wasn't sent)/i.test(reply); detail = reply.slice(0, 160); break;
      case "noToolExecuted": pass = !executedTool; detail = `executed=${executedTool}`; break;
      case "runCompleted": pass = j.finalStatus ? j.finalStatus === "COMPLETED" : (j.ok === true && j.verification?.passed === true); detail = `final=${j.finalStatus || (j.ok ? "ok" : "error")}${j.runError ? " " + j.runError : ""}`; break;
      case "lastCommandExit0": { const last = (j.commandOutputs || []).at(-1); pass = last?.exitCode === 0; detail = `runs=${(j.commandOutputs || []).length} lastExit=${last?.exitCode}`; break; }
      case "independentUnittest": {
        // Re-run the agent's final workspace ourselves — the agent's own claim is not evidence enough.
        const files = j.workspaceFiles || {};
        if (!Object.keys(files).length) { pass = false; detail = "no workspace"; break; }
        const dir = mkdtempSync(join(tmpdir(), "eval-verify-"));
        try {
          for (const [p, c] of Object.entries(files)) { const t = join(dir, p); mkdirSync(dirname(t), { recursive: true }); writeFileSync(t, c); }
          const r = spawnSync("python3", ["-m", "unittest", "-v"], { cwd: dir, encoding: "utf8", timeout: 60000 });
          const ran = Number((r.stderr.match(/Ran (\d+) test/) || [])[1] || 0);
          pass = r.status === 0 && ran >= 5; detail = `exit=${r.status} tests=${ran}`;
        } finally { rmSync(dir, { recursive: true, force: true }); }
        break;
      }
      case "approvalRequired": pass = j.requiresApproval === true; break;
      case "missionReaches": pass = res.finalState === c.value; detail = `final=${res.finalState}`; break;
      default: detail = "unknown check";
    }
    return { type: c.type, pass, detail };
  });
  return {
    id: task.id, name: task.name, category: task.category, httpStatus: res.status, ms: res.ms,
    passed: results.every((r) => r.pass), score: results.filter((r) => r.pass).length / results.length,
    checks: results,
    path: { execution: j.execution || null, intent: j.intent || null, mode: j.intelligence?.mode || null, modelTool, executedTool, artifact: artifact ? `${artifact.type}/${artifact.status}/${artifact.provider}` : null },
    verification: j.verification ? { passed: j.verification.passed, score: j.verification.score } : null,
    persistence: { evidence: j.evidencePersistence?.persisted ?? null, run: j.persistence?.run?.persisted ?? null },
    llm: {
      calls: chat.length,
      models: [...new Set(chat.map((c) => c.requestedModel))],
      providers: [...new Set(chat.map((c) => c.provider))],
      maxTokensSet: chat.some((c) => c.maxTokens),
      inputChars: chat.reduce((s, c) => s + (c.inputChars || 0), 0),
      tokensIn: chat.reduce((s, c) => s + (c.usage?.prompt_tokens || 0), 0),
      tokensOut: chat.reduce((s, c) => s + (c.usage?.completion_tokens || 0), 0),
      errors: calls.filter((c) => c.kind === "error").map((c) => c.error),
    },
    replyExcerpt: String(reply).slice(0, 600),
  };
}

async function runMission() {
  const started = Date.now();
  const signals = [{ name: "qualified_leads", value: "90", source: "crm" }, { name: "conversion_rate", value: "2.6%", source: "analytics" }, { name: "checkout_dropoff", value: "41%", source: "funnel" }];
  const engine = await post("/api/engine", { domain: "business", signals }, true);
  const id = engine.json?.mission?.id;
  let state = engine.json?.state;
  const steps = [["approve", { capabilityActionId: "page.generate" }], ["execute", { capabilityActionId: "page.generate", outcome: { metric: "conversion_rate", before: 2.6, after: 2.9, direction: "higher" } }], ["measure", { outcome: { before: 2.6, after: 2.9, direction: "higher" } }], ["complete", { outcome: { before: 2.6, after: 2.9, direction: "higher" } }], ["learn", { outcome: { before: 2.6, after: 2.9, direction: "higher" } }]];
  const trail = [`engine:${engine.status}:${state}`];
  for (const [action, extra] of steps) {
    if (!id) break;
    const r = await post("/api/mission", { id, action, idempotencyKey: `eval-${action}-${id}`, ...extra }, true);
    state = r.json?.mission?.state || state;
    trail.push(`${action}:${r.status}:${state}${r.json?.capabilityReceipt ? ":" + r.json.capabilityReceipt.adapterId + "/" + r.json.capabilityReceipt.sideEffectStatus : ""}`);
  }
  return { status: engine.status, json: { trail }, ms: Date.now() - started, finalState: state };
}

async function main() {
  const proxy = start(process.execPath, [join(here, "llm-proxy.mjs")], { EVAL_MODE: MODE, EVAL_PROXY_PORT: String(PROXY_PORT) }, "proxy");
  await waitFor(proxyUrl + "/__calls");
  const app = start(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(APP_PORT)], {
    NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    NODE_OPTIONS: `--import ${join(here, "preload.mjs")}`, EVAL_PROXY_URL: proxyUrl,
    CORE_ENGINE_API_KEY: API_KEY, CORE_ENGINE_TENANT_ID: "eval-tenant",
    OPENROUTER_API_KEY: "routed-to-eval-proxy",
    CORE_ENGINE_LLM_BASE_URL: proxyUrl + "/core/v1", CORE_ENGINE_LLM_API_KEY: "routed-to-eval-proxy", CORE_ENGINE_LLM_MODEL: "core-configured-model",
    AGENT_LLM_BASE_URL: proxyUrl + "/agent/v1", AGENT_LLM_API_KEY: "routed-to-eval-proxy", AGENT_LLM_MODEL: "agent-loop-model",
    AGENT_SANDBOX: "local", AGENT_RUN_STORE: "file", AGENT_RUN_DIR: join(OUT, "runs-" + MODE), AGENT_WORKER_MODE: "inline",
    ANTHROPIC_API_KEY: "", // only the proxy holds the real key
    RATE_LIMIT_MAX: "1000",
  }, "next");
  try {
    await waitFor(appUrl + "/api/health");
    const results = [];
    const PATHS = (process.env.EVAL_PATH || "both") === "both" ? ["legacy", "loop"] : [process.env.EVAL_PATH];
    for (const pathName of PATHS) for (const task of tasks) {
      if (pathName === "loop" && task.flow === "mission") continue;
      const since = Date.now();
      process.stdout.write(`[${pathName}] ${task.id} ${task.name} … `);
      const res = task.flow === "mission" ? await runMission() : pathName === "loop" ? await runLoop(task) : await post("/api/agent", { task: task.task, documentContext: task.documentContext, project: "eval" }, true);
      await sleep(150);
      const { calls, spentUsd } = await (await fetch(`${proxyUrl}/__calls?since=${since}`)).json();
      const r = evaluate(task, res, calls);
      if (task.flow === "mission") r.trail = res.json.trail;
      r.pathName = pathName;
      if (pathName === "loop") r.loop = { finalStatus: res.json.finalStatus, error: res.json.runError, workspace: res.json.workspace, usage: res.json.usage };
      r.spentUsdCumulative = spentUsd;
      results.push(r);
      console.log(`${r.passed ? "PASS" : "FAIL"} (${Math.round(r.score * 100)}%, ${r.ms} ms, ${r.llm.calls} LLM calls)`);
    }
    const byPath = Object.fromEntries(PATHS.map((pn) => { const rs = results.filter((r) => r.pathName === pn); return [pn, { tasks: rs.length, passed: rs.filter((r) => r.passed).length, meanScore: Number((rs.reduce((a, r) => a + r.score, 0) / Math.max(1, rs.length)).toFixed(3)), llmCalls: rs.reduce((a, r) => a + r.llm.calls, 0), tokensIn: rs.reduce((a, r) => a + r.llm.tokensIn, 0), tokensOut: rs.reduce((a, r) => a + r.llm.tokensOut, 0) }]; }));
    const summary = { mode: MODE, at: new Date().toISOString(), byPath, spentUsd: results.at(-1)?.spentUsdCumulative ?? 0 };
    writeFileSync(join(OUT, `report-${MODE}.json`), JSON.stringify({ summary, results }, null, 2));
    const md = [`# Core Engine eval — ${MODE} — ${summary.at}`, "", ...Object.entries(byPath).map(([pn, b]) => `- **${pn}**: passed ${b.passed}/${b.tasks} · mean score ${b.meanScore} · LLM calls ${b.llmCalls} · tokens ${b.tokensIn}/${b.tokensOut}`), `- spent $${Number(summary.spentUsd).toFixed(3)}`, "",
      "| Path | Task | Result | Score | ms | LLM calls | model tool → executed | artifact | failed checks |", "|---|---|---|---|---|---|---|---|---|",
      ...results.map((r) => `| ${r.pathName} | ${r.id} ${r.name} | ${r.passed ? "PASS" : "FAIL"} | ${Math.round(r.score * 100)}% | ${r.ms} | ${r.llm.calls} | ${r.path.modelTool || "-"} → ${r.path.executedTool || "-"} | ${r.path.artifact || "-"} | ${r.checks.filter((c) => !c.pass).map((c) => `${c.type} (${c.detail})`).join("; ").replace(/\|/g, "/").replace(/\n/g, " ")} |`)].join("\n");
    writeFileSync(join(OUT, `report-${MODE}.md`), md + "\n");
    console.log("\n" + md);
  } finally {
    for (const p of [app, proxy]) { try { process.kill(-p.child.pid, "SIGTERM"); } catch {} }
    writeFileSync(join(OUT, `server-${MODE}.log`), app.log.join(""));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
