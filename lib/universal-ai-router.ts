import { randomUUID } from "node:crypto";
import { routeIntelligenceTask, type IntelligenceRoute } from "@/lib/m12-intelligence-router";
import { buildContextEnvelope, serializeContextEnvelope } from "@/lib/m13-context-engine";

export type UniversalProvider = {
  id: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  protocol: "openai-compatible" | "gemini";
  priority: number;
};

export type UniversalResult = {
  ok: boolean;
  provider?: string;
  model?: string;
  text?: string;
  latencyMs?: number;
  attempts: Array<{ provider: string; model: string; ok: boolean; error?: string; latencyMs: number }>;
  requestId: string;
  routing?: {
    mode: "single" | "escalation" | "consensus";
    complexity: number;
    domain: string;
    reasons?: string[];
    selectedModels?: string[];
    fallbackModels?: string[];
    consensusModels?: string[];
    judgeModel?: string;
  };
};

function env(name: string) { return process.env[name]?.trim() || ""; }

function providers(): UniversalProvider[] {
  const list: UniversalProvider[] = [];
  const coreKey = env("CORE_ENGINE_LLM_API_KEY");
  const coreBase = env("CORE_ENGINE_LLM_BASE_URL");
  const coreModel = env("CORE_ENGINE_LLM_MODEL");
  if (coreKey && coreBase && coreModel) list.push({ id: "core-configured", model: coreModel, baseUrl: coreBase, apiKey: coreKey, protocol: "openai-compatible", priority: 20 });

  const openRouterKey = env("OPENROUTER_API_KEY");
  const openRouterModel = env("OPENROUTER_MODEL") || "openai/gpt-5-mini";
  if (openRouterKey) list.push({ id: "openrouter", model: openRouterModel, baseUrl: "https://openrouter.ai/api/v1", apiKey: openRouterKey, protocol: "openai-compatible", priority: 10 });

  const xaiKey = env("XAI_API_KEY");
  if (xaiKey) list.push({ id: "xai", model: env("XAI_MODEL") || "grok-4.7", baseUrl: "https://api.x.ai/v1", apiKey: xaiKey, protocol: "openai-compatible", priority: 30 });

  const openaiKey = env("OPENAI_API_KEY");
  if (openaiKey) list.push({ id: "openai", model: env("OPENAI_MODEL") || "gpt-5-mini", baseUrl: "https://api.openai.com/v1", apiKey: openaiKey, protocol: "openai-compatible", priority: 40 });

  return list.sort((a,b) => a.priority - b.priority);
}

function toolManifest() {
  return [
    "multitask.weather.current — live weather/forecast",
    "multitask.data.analyze — CSV/JSON/table analysis and charts",
    "multitask.website.build — generate actual self-contained website",
    "multitask.document.create — create PDF/DOCX",
    "multitask.image.edit — image transformation",
    "multitask.image.combine — semantic image compositing",
    "multitask.video.prepare — image-to-video preparation/provider"
  ].join("
");
}

function systemPrompt() {
  return [
    "You are the Universal Intelligence layer of Core Engine AI.",
    "Answer the user's actual request, not merely a plan.",
    "Core Engine has local tools for weather, data, websites, documents, images and video.",
    "If a tool is needed, identify it explicitly as TOOL_REQUIRED in a compact JSON line, but do not falsely claim it executed.",
    "Never invent external actions, live data, file contents, citations or generated artifacts.",
    "For ordinary knowledge, reasoning, writing and analysis, solve directly.",
    "For calculations, solve exactly.",
    "For live/current information, say when external/live tooling is required.",
    "For side effects such as sending, deploying, publishing or changing external systems, require human approval.",
    "Available tools:
" + toolManifest()
  ].join("
");
}

async function callOpenAICompatible(p: UniversalProvider, task: string, context: string, imageData: string, modelOverride?: string, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const content: Array<Record<string, unknown>> = [{ type: "text", text: task + (context ? "

CONTEXT:
" + context.slice(0, 50000) : "") }];
    if (imageData.startsWith("data:image/")) content.push({ type: "image_url", image_url: { url: imageData } });
    const response = await fetch(p.baseUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.apiKey },
      body: JSON.stringify({
        model: modelOverride || p.model,
        temperature: 0.2,
        ...(p.id === "openrouter" ? {
          plugins: [{ id: "response-healing" }],
          ...( /(research|zbadaj|sprawdź|sprawdz|aktual|today|latest|news|źródła|sources|konkurenc)/i.test(task) ? {
            tools: [
              { type: "openrouter:web_search", parameters: { engine: "auto", max_results: 6 } },
              { type: "openrouter:web_fetch", parameters: { engine: "openrouter", max_content_tokens: 20000 } }
            ]
          } : {})
        } : {}),
        messages: [{ role: "system", content: systemPrompt() }, { role: "user", content }]
      }),
      signal: controller.signal
    });
    const raw = await response.text();
    if (!response.ok) throw new Error("HTTP_" + response.status + ":" + raw.slice(0, 240));
    const body = JSON.parse(raw);
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("EMPTY_MODEL_RESPONSE");
    return text.trim();
  } finally { clearTimeout(timer); }
}

function routingFrom(route: IntelligenceRoute) {
  return {
    mode: route.mode,
    complexity: route.complexity,
    domain: route.domain,
    reasons: route.reasons,
    selectedModels: route.candidateModels,
    fallbackModels: route.fallbackModels,
    consensusModels: route.consensusModels,
    judgeModel: route.judgeModel || undefined
  };
}

export async function universalGenerate(task: string, context = "", imageData = "", timeoutMs = 25000): Promise<UniversalResult> {
  const requestId = "ce-" + randomUUID();
  const startedTotal = Date.now();
  const list = providers();
  const attempts: UniversalResult["attempts"] = [];
  const route = routeIntelligenceTask(task);
  const contextEnvelope = buildContextEnvelope(task, context);
  const boundedContext = serializeContextEnvelope(contextEnvelope);
  if (!list.length) return { ok: false, attempts, requestId, routing: routingFrom(route) };

  const openRouter = list.find(p => p.id === "openrouter");
  if (openRouter && route.mode === "consensus" && route.consensusModels.length >= 2) {
    const consensusStarted = Date.now();
    const results = await Promise.allSettled(route.consensusModels.map(model => callOpenAICompatible(openRouter, task, boundedContext, imageData, model, timeoutMs)));
    const answers: string[] = [];
    results.forEach((result, index) => {
      const model = route.consensusModels[index];
      const latencyMs = Date.now() - consensusStarted;
      if (result.status === "fulfilled") {
        answers.push(result.value);
        attempts.push({ provider: "openrouter", model, ok: true, latencyMs });
      } else {
        attempts.push({ provider: "openrouter", model, ok: false, error: result.reason instanceof Error ? result.reason.message : "PROVIDER_FAILED", latencyMs });
      }
    });
    if (answers.length >= 2) {
      const judgeModel = route.judgeModel || route.consensusModels[1];
      const judgeContext = "CANDIDATE ANSWERS:

" + answers.map((answer, i) => "ANSWER " + (i + 1) + ":
" + answer).join("

");
      const judgeStarted = Date.now();
      try {
        const judged = await callOpenAICompatible(openRouter, "Independently compare the candidate answers above. Return the best verified answer, correcting contradictions and unsupported claims.", boundedContext + "

" + judgeContext, "", judgeModel, timeoutMs);
        attempts.push({ provider: "openrouter", model: judgeModel, ok: true, latencyMs: Date.now() - judgeStarted });
        return { ok: true, provider: "openrouter", model: judgeModel, text: judged, latencyMs: Date.now() - startedTotal, attempts, requestId, routing: routingFrom(route) };
      } catch (e) {
        attempts.push({ provider: "openrouter", model: judgeModel, ok: false, error: e instanceof Error ? e.message : "JUDGE_FAILED", latencyMs: Date.now() - judgeStarted });
      }
    }
  }

  const orderedModels = route.mode === "single" ? route.candidateModels.slice(0, 1) : route.candidateModels;
  for (const p of list) {
    const models = p.id === "openrouter" && orderedModels.length ? orderedModels : [p.model];
    for (const model of models) {
      const started = Date.now();
      try {
        const text = await callOpenAICompatible(p, task, boundedContext, imageData, model, timeoutMs);
        const latencyMs = Date.now() - started;
        attempts.push({ provider: p.id, model, ok: true, latencyMs });
        return { ok: true, provider: p.id, model, text, latencyMs: Date.now() - startedTotal, attempts, requestId, routing: routingFrom(route) };
      } catch (e) {
        attempts.push({ provider: p.id, model, ok: false, error: e instanceof Error ? e.message : "PROVIDER_FAILED", latencyMs: Date.now() - started });
      }
    }
  }

  return { ok: false, attempts, requestId, routing: routingFrom(route) };
}

export function universalProviderReadiness() {
  return providers().map(p => ({ id: p.id, model: p.model, protocol: p.protocol, priority: p.priority, configured: true }));
}
