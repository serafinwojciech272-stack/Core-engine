// Eval proxy: an OpenAI-compatible endpoint that records every call made by Core Engine.
// Modes:
//   EVAL_MODE=mock       deterministic scripted responses (architecture behaviour, zero cost)
//   EVAL_MODE=anthropic  forwards to Anthropic's OpenAI-compatible API with a hard USD budget
// Weather endpoints always return labelled fixtures (open-meteo is not reachable from the sandbox).
import http from "node:http";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.EVAL_PROXY_PORT || 4500);
const MODE = process.env.EVAL_MODE || "mock";
const OUT = process.env.EVAL_OUT || join(here, "out");
const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD || 5);
const MODEL = process.env.EVAL_MODEL || "claude-sonnet-4-5";
const PRICE_IN = Number(process.env.EVAL_PRICE_IN_PER_MTOK || 3);
const PRICE_OUT = Number(process.env.EVAL_PRICE_OUT_PER_MTOK || 15);
const MAX_TOKENS_CAP = Number(process.env.EVAL_MAX_TOKENS_CAP || 8000);
mkdirSync(OUT, { recursive: true });

const tasks = JSON.parse(readFileSync(join(here, "tasks.json"), "utf8")).tasks;
const calls = [];
let spentUsd = 0;

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p?.text === "string" ? p.text : "")).join("\n");
  return "";
}

function findTask(messages) {
  const user = messages.filter((m) => m.role === "user").map((m) => textOf(m.content)).join("\n");
  return tasks.find((t) => t.task && user.includes(t.task.slice(0, 60)));
}

function completion(model, message, usage = { prompt_tokens: 0, completion_tokens: 0 }) {
  return { id: "eval-" + Date.now(), object: "chat.completion", model, choices: [{ index: 0, finish_reason: message.tool_calls ? "tool_calls" : "stop", message }], usage };
}

function mockReply(body) {
  const messages = body.messages || [];
  const system = textOf(messages.find((m) => m.role === "system")?.content);
  const task = findTask(messages);
  const userText = textOf(messages.filter((m) => m.role === "user").at(-1)?.content);
  const last = messages.at(-1);

  if (/You are Core Engine, an autonomous agent/.test(system)) {
    // Scripted "competent model" for the durable loop: follows task.mockPlan, then finishes.
    const k = messages.filter((m) => m.role === "assistant").length;
    const plan = task?.mockPlan || [];
    if (k < plan.length) {
      const [name, args] = plan[k];
      return completion(body.model, { role: "assistant", content: null, tool_calls: [{ id: `mock_${k}_${Date.now()}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
    }
    if (task?.mockFinish && k === plan.length) {
      return completion(body.model, { role: "assistant", content: null, tool_calls: [{ id: `mock_finish_${Date.now()}`, type: "function", function: { name: "finish", arguments: JSON.stringify({ summary: "Wykonano wszystkie kroki planu.", criteria: task.mockFinish.map(([criterion, evidence]) => ({ criterion, met: true, evidence })) }) } }] });
    }
    const lastTool = [...messages].reverse().find((m) => m.role === "tool");
    return completion(body.model, { role: "assistant", content: task?.mockAnswer || (lastTool ? "Na podstawie wyniku narzędzia: " + textOf(lastTool.content).slice(0, 600) : "[MOCK ANSWER] " + (task?.task || userText).slice(0, 300)) });
  }
  if (/expert web designer/i.test(system)) {
    const brief = userText.split("BRIEF:").pop().trim().slice(0, 300);
    return completion(body.model, { role: "assistant", content: `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Mock</title></head><body><nav>Menu · Godziny · Rezerwacja</nav><main><h1>${brief}</h1><section id="menu">Menu</section><section id="godziny">Godziny otwarcia</section><section id="rezerwacja">Rezerwacja stolika</section></main>${"<p>mock content</p>".repeat(30)}</body></html>` });
  }
  if (Array.isArray(body.tools) && body.tool_choice !== "none" && last?.role === "user" && task?.mockTool) {
    return completion(body.model, {
      role: "assistant", content: null,
      tool_calls: [{ id: "call_mock_1", type: "function", function: { name: task.mockTool, arguments: JSON.stringify(task.mockToolArgs || { task: task.task }) } }],
    });
  }
  if (last?.role === "tool") {
    return completion(body.model, { role: "assistant", content: "Na podstawie wyniku narzędzia: " + textOf(last.content).slice(0, 400) });
  }
  const echo = (task?.task || userText).slice(0, 400);
  return completion(body.model, { role: "assistant", content: `[MOCK ANSWER] Odpowiedź na zadanie: ${echo}\n\nTo jest deterministyczna odpowiedź testowa, nie wynik modelu.` });
}

async function anthropicReply(body) {
  if (spentUsd >= BUDGET_USD) {
    const e = new Error("EVAL_BUDGET_EXCEEDED"); e.status = 429; throw e;
  }
  const allowed = ["messages", "tools", "tool_choice", "max_tokens", "stop"]; // temperature/top_p rejected by current Claude models
  const forward = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  forward.model = MODEL;
  forward.max_tokens = Math.min(Number(body.max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);
  if (forward.tool_choice === "none") { delete forward.tools; delete forward.tool_choice; }
  const r = await fetch("https://api.anthropic.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + process.env.ANTHROPIC_API_KEY },
    body: JSON.stringify(forward),
  });
  const json = await r.json().catch(() => ({}));
  const u = json?.usage || {};
  spentUsd += ((u.prompt_tokens || 0) * PRICE_IN + (u.completion_tokens || 0) * PRICE_OUT) / 1e6;
  if (!r.ok) { const e = new Error("UPSTREAM_" + r.status + ":" + JSON.stringify(json).slice(0, 300)); e.status = r.status; throw e; }
  json.model = body.model; // report the model Core Engine asked for
  return json;
}

function weatherFixture(kind, url) {
  if (kind === "geocoding") {
    const name = (new URL(url, "http://x").searchParams.get("name") || "").toLowerCase();
    const known = [["gliwic", "Gliwice", 50.29, 18.67], ["gdańsk", "Gdańsk", 54.35, 18.65], ["gdansk", "Gdańsk", 54.35, 18.65], ["krak", "Kraków", 50.06, 19.94], ["warsz", "Warszawa", 52.23, 21.01]];
    const hit = known.find(([stem]) => name.startsWith(stem));
    return { results: hit ? [{ name: hit[1], latitude: hit[2], longitude: hit[3] }] : [], fixture: true };
  }
  return { current: { temperature_2m: 11.4, relative_humidity_2m: 81, apparent_temperature: 9.8, weather_code: 61, wind_speed_10m: 14.2 }, fixture: true };
}

function record(entry) {
  calls.push(entry);
  appendFileSync(join(OUT, `calls-${MODE}.jsonl`), JSON.stringify(entry) + "\n");
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = req.url || "/";
  if (url.startsWith("/__calls")) {
    const since = Number(new URL(url, "http://x").searchParams.get("since") || 0);
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ mode: MODE, spentUsd, budgetUsd: BUDGET_USD, calls: calls.filter((c) => c.t >= since) }));
  }
  const [, provider] = url.split("/");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    if (provider === "geocoding" || provider === "forecast") {
      const out = weatherFixture(provider, url);
      record({ t: started, provider, kind: "weather-fixture", url, ms: 0 });
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify(out));
    }
    if (!url.endsWith("/chat/completions")) {
      record({ t: started, provider, kind: "unsupported", url });
      res.statusCode = 501; return res.end(JSON.stringify({ error: "EVAL_PROXY_UNSUPPORTED", url }));
    }
    const body = JSON.parse(raw || "{}");
    const reply = MODE === "anthropic" ? await anthropicReply(body) : mockReply(body);
    const msg = reply?.choices?.[0]?.message || {};
    record({
      t: started, provider, kind: "chat", requestedModel: body.model, mode: MODE,
      inputChars: JSON.stringify(body.messages || []).length, tools: (body.tools || []).length, toolChoice: body.tool_choice ?? null,
      maxTokens: body.max_tokens ?? null, toolCall: msg.tool_calls?.[0]?.function?.name ?? null,
      usage: reply.usage || null, ms: Date.now() - started, spentUsd,
    });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(reply));
  } catch (error) {
    record({ t: started, provider, kind: "error", error: String(error?.message || error).slice(0, 300), ms: Date.now() - started });
    res.statusCode = error?.status || 500;
    res.end(JSON.stringify({ error: { message: String(error?.message || error) } }));
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`[eval-proxy] ${MODE} on :${PORT}`));
