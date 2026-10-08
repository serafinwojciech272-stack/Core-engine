import { randomUUID } from "node:crypto";

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
  ].join("\n");
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
    "Available tools:\n" + toolManifest()
  ].join("\n");
}

function openRouterFallbackModels(primary: string) {
  const configured = env("OPENROUTER_FALLBACK_MODELS");
  const defaults = ["anthropic/claude-sonnet-5.5", "openai/gpt-5.4-mini"];
  const models = (configured ? configured.split(",") : defaults).map(v => v.trim()).filter(Boolean);
  return Array.from(new Set(models.filter(m => m !== primary)));
}

async function callOpenAICompatible(p: UniversalProvider, task: string, context: string, imageData: string, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const content: Array<Record<string, unknown>> = [{ type: "text", text: task + (context ? "\n\nCONTEXT:\n" + context.slice(0, 50000) : "") }];
    if (imageData.startsWith("data:image/")) content.push({ type: "image_url", image_url: { url: imageData } });
    const response = await fetch(p.baseUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.apiKey },
      body: JSON.stringify({
        model: p.model,
        temperature: 0.2,
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

export async function universalGenerate(task: string, context = "", imageData = "", timeoutMs = 25000): Promise<UniversalResult> {
  const requestId = "ce-" + randomUUID();
  const list = providers();
  const attempts: UniversalResult["attempts"] = [];
  if (!list.length) return { ok: false, attempts, requestId };

  for (const p of list) {
    const started = Date.now();
    try {
      const text = await callOpenAICompatible(p, task, context, imageData, timeoutMs);
      const latencyMs = Date.now() - started;
      attempts.push({ provider: p.id, model: p.model, ok: true, latencyMs });
      return { ok: true, provider: p.id, model: p.model, text, latencyMs, attempts, requestId };
    } catch (e) {
      const latencyMs = Date.now() - started;
      attempts.push({ provider: p.id, model: p.model, ok: false, error: e instanceof Error ? e.message : "PROVIDER_FAILED", latencyMs });
    }
  }
  return { ok: false, attempts, requestId };
}

export function universalProviderReadiness() {
  return providers().map(p => ({ id: p.id, model: p.model, protocol: p.protocol, priority: p.priority, configured: true }));
}
