// Single LLM gateway for the agent loop: one OpenAI-compatible client with tool calling,
// bounded output tokens, timeout, retry on transient errors and cost accounting.
import type { ChatMessage, ToolCall } from "@/lib/agent-loop/contracts";

export type LlmToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
export type LlmRequest = { messages: ChatMessage[]; tools?: LlmToolSpec[]; maxOutputTokens: number; temperature?: number; signal?: AbortSignal };
export type LlmResponse = {
  message: { content: string | null; tool_calls?: ToolCall[] };
  usage: { promptTokens: number; completionTokens: number; costUsd: number };
  model: string;
  finishReason: string | null; // "length" means the output was cut at max_tokens
};
export interface LlmClient { readonly model: string; complete(request: LlmRequest): Promise<LlmResponse> }

export class LlmError extends Error {
  readonly retryable: boolean;
  readonly status?: number;
  constructor(message: string, retryable: boolean, status?: number) { super(message); this.retryable = retryable; this.status = status; }
}

export type OpenAiCompatibleConfig = {
  baseUrl: string; apiKey: string; model: string;
  priceInPerMTok?: number; priceOutPerMTok?: number;
  timeoutMs?: number; maxAttempts?: number;
  extraHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>;
};

export function createOpenAiCompatibleClient(config: OpenAiCompatibleConfig): LlmClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const sleep = config.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = config.timeoutMs ?? 90_000;
  const maxAttempts = Math.max(1, config.maxAttempts ?? 3);
  const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";

  async function once(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener("abort", onAbort);
    try {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json", authorization: "Bearer " + config.apiKey, ...(config.extraHeaders || {}) },
          body: JSON.stringify({
            model: config.model,
            messages: request.messages,
            ...(request.tools?.length ? { tools: request.tools, tool_choice: "auto" } : {}),
            max_tokens: request.maxOutputTokens,
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          }),
        });
      } catch (error) {
        throw new LlmError("LLM_NETWORK_ERROR:" + (error instanceof Error ? error.message : String(error)), true);
      }
      const raw = await response.text();
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new LlmError(`LLM_HTTP_${response.status}:${raw.slice(0, 300)}`, retryable, response.status);
      }
      let body: { choices?: Array<{ finish_reason?: string; message?: { content?: string | null; tool_calls?: ToolCall[] } }>; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
      try { body = JSON.parse(raw); } catch { throw new LlmError("LLM_INVALID_JSON", true); }
      const message = body.choices?.[0]?.message;
      if (!message) throw new LlmError("LLM_EMPTY_RESPONSE", true);
      const promptTokens = Number(body.usage?.prompt_tokens || 0);
      const completionTokens = Number(body.usage?.completion_tokens || 0);
      const costUsd = (promptTokens * (config.priceInPerMTok ?? 0) + completionTokens * (config.priceOutPerMTok ?? 0)) / 1e6;
      return {
        message: { content: typeof message.content === "string" ? message.content : null, tool_calls: Array.isArray(message.tool_calls) && message.tool_calls.length ? message.tool_calls : undefined },
        usage: { promptTokens, completionTokens, costUsd },
        model: body.model || config.model,
        finishReason: body.choices?.[0]?.finish_reason ?? null,
      };
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }
  }

  return {
    model: config.model,
    async complete(request) {
      let last: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try { return await once(request); } catch (error) {
          last = error;
          const retryable = error instanceof LlmError ? error.retryable : true;
          if (!retryable || attempt === maxAttempts || request.signal?.aborted) break;
          await sleep(Math.min(20_000, 1000 * 2 ** (attempt - 1)));
        }
      }
      throw last instanceof Error ? last : new LlmError(String(last), false);
    },
  };
}

export type LlmProvider = "custom" | "anthropic" | "openrouter";
export type LlmConfigSummary = { configured: boolean; provider: LlmProvider | null; model: string | null; issue: string | null };

/**
 * Which provider/model the agent will use, without secrets (ADR-003). `issue` explains a configuration
 * that would fail at the first call — e.g. a native Anthropic model id routed to OpenRouter because
 * ANTHROPIC_API_KEY is missing. Order: explicit AGENT_LLM_* → Anthropic (OpenAI-compatible) → OpenRouter.
 */
export function describeLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfigSummary {
  const model = env.AGENT_LLM_MODEL?.trim() || null;
  if (env.AGENT_LLM_BASE_URL && env.AGENT_LLM_API_KEY && model) return { configured: true, provider: "custom", model, issue: null };
  if (env.ANTHROPIC_API_KEY?.trim() && model) return { configured: true, provider: "anthropic", model, issue: null };
  if (env.OPENROUTER_API_KEY?.trim()) {
    const orModel = model || env.OPENROUTER_MODEL?.trim() || "openai/gpt-5-mini";
    const issue = /^claude-/i.test(orModel)
      ? `AGENT_LLM_MODEL "${orModel}" is a native Anthropic id but ANTHROPIC_API_KEY is not set; OpenRouter needs a "vendor/model" id`
      : null;
    return { configured: !issue, provider: "openrouter", model: orModel, issue };
  }
  if (env.ANTHROPIC_API_KEY?.trim() && !model) return { configured: false, provider: "anthropic", model: null, issue: "ANTHROPIC_API_KEY is set but AGENT_LLM_MODEL is empty" };
  return { configured: false, provider: null, model, issue: "no LLM provider configured (AGENT_LLM_*, ANTHROPIC_API_KEY or OPENROUTER_API_KEY)" };
}

export function createLlmClientFromEnv(env: Record<string, string | undefined> = process.env): LlmClient | null {
  const summary = describeLlmConfig(env);
  if (!summary.configured || !summary.model) return null; // callers surface summary.issue instead of failing mid-run
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  const priceIn = num(env.AGENT_LLM_PRICE_IN_PER_MTOK, 3);
  const priceOut = num(env.AGENT_LLM_PRICE_OUT_PER_MTOK, 15);
  const base = { model: summary.model, priceInPerMTok: priceIn, priceOutPerMTok: priceOut };
  if (summary.provider === "custom") return createOpenAiCompatibleClient({ ...base, baseUrl: env.AGENT_LLM_BASE_URL!, apiKey: env.AGENT_LLM_API_KEY! });
  if (summary.provider === "anthropic") return createOpenAiCompatibleClient({ ...base, baseUrl: "https://api.anthropic.com/v1", apiKey: env.ANTHROPIC_API_KEY!.trim() });
  return createOpenAiCompatibleClient({ ...base, baseUrl: "https://openrouter.ai/api/v1", apiKey: env.OPENROUTER_API_KEY!.trim(), extraHeaders: { "X-Title": "Core Engine AI" } });
}
