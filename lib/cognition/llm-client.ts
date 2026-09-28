import { createHash } from "node:crypto";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };
export type LlmAuditContext = { tenantId: string; missionId?: string; operation: string; promptName: string; promptVersion: string; promptHash: string };
export type LlmRequest = { messages: LlmMessage[]; temperature?: number; maxTokens?: number; audit: LlmAuditContext };
export type LlmResponse = { content: string; model: string; latencyMs: number; promptTokens?: number; completionTokens?: number; totalTokens?: number };
export type LlmErrorKind = "NOT_CONFIGURED" | "AUTH" | "RATE_LIMIT" | "TIMEOUT" | "NETWORK" | "BAD_REQUEST" | "SERVER" | "INVALID_RESPONSE" | "AUDIT_FAILED" | "UNKNOWN";

export class LlmClientError extends Error {
  readonly kind: LlmErrorKind; readonly retryable: boolean; readonly status?: number; readonly providerCode?: string;
  constructor(input: { kind: LlmErrorKind; message: string; retryable: boolean; status?: number; providerCode?: string }) {
    super(input.message); this.name = "LlmClientError"; this.kind = input.kind; this.retryable = input.retryable; this.status = input.status; this.providerCode = input.providerCode;
  }
}

type AuditWriter = (input: { audit: LlmAuditContext; model: string; requestMessages: LlmMessage[]; responseContent: string | null; latencyMs: number; promptTokens?: number; completionTokens?: number; totalTokens?: number; success: boolean; errorKind?: LlmErrorKind }) => Promise<void>;
type LlmClientOptions = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; auditWriter?: AuditWriter; maxAttempts?: number; timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const BACKOFF_MS = [250, 500] as const;

function configuration() {
  const baseUrl = process.env.CORE_ENGINE_LLM_BASE_URL?.trim();
  const apiKey = process.env.CORE_ENGINE_LLM_API_KEY?.trim();
  const model = process.env.CORE_ENGINE_LLM_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) throw new LlmClientError({ kind: "NOT_CONFIGURED", message: "LLM provider is not configured.", retryable: false });
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}
function endpoint(baseUrl: string) {
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl;
  return baseUrl.endsWith("/v1") ? baseUrl + "/chat/completions" : baseUrl + "/v1/chat/completions";
}
function classifyStatus(status: number): { kind: LlmErrorKind; retryable: boolean } {
  if (status === 401 || status === 403) return { kind: "AUTH", retryable: false };
  if (status === 429) return { kind: "RATE_LIMIT", retryable: true };
  if (status === 400 || status === 404 || status === 422) return { kind: "BAD_REQUEST", retryable: false };
  if (status >= 500) return { kind: "SERVER", retryable: true };
  return { kind: "UNKNOWN", retryable: false };
}
async function defaultAuditWriter(input: Parameters<AuditWriter>[0]) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) throw new LlmClientError({ kind: "AUDIT_FAILED", message: "Durable LLM audit configuration is missing.", retryable: false });
  const response = await fetch(url.replace(/\/+$/, "") + "/rest/v1/ce_cognition_audit_events", {
    method: "POST", cache: "no-store",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ tenant_id: input.audit.tenantId, mission_id: input.audit.missionId ?? null, operation: input.audit.operation, prompt_name: input.audit.promptName, prompt_version: input.audit.promptVersion, prompt_hash: input.audit.promptHash, model: input.model, request_messages: input.requestMessages, response_content: input.responseContent, latency_ms: input.latencyMs, prompt_tokens: input.promptTokens ?? null, completion_tokens: input.completionTokens ?? null, total_tokens: input.totalTokens ?? null, success: input.success, error_kind: input.errorKind ?? null }),
  });
  if (!response.ok) throw new LlmClientError({ kind: "AUDIT_FAILED", message: "Durable LLM audit write failed: " + response.status, retryable: false, status: response.status });
}
export function requestHash(messages: LlmMessage[]) { return createHash("sha256").update(JSON.stringify(messages)).digest("hex"); }
export interface LlmClient { complete(request: LlmRequest): Promise<LlmResponse>; }

export function createLlmClient(options: LlmClientOptions = {}): LlmClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const auditWriter = options.auditWriter ?? defaultAuditWriter;
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 5));
  const timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return {
    async complete(request) {
      const config = configuration();
      if (!request.messages.length) throw new LlmClientError({ kind: "BAD_REQUEST", message: "At least one LLM message is required.", retryable: false });
      const started = Date.now(); let lastError: LlmClientError | undefined;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(endpoint(config.baseUrl), { method: "POST", cache: "no-store", signal: controller.signal, headers: { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model, messages: request.messages, temperature: request.temperature ?? 0, ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}) }) });
          if (!response.ok) {
            const classified = classifyStatus(response.status); let providerCode: string | undefined;
            try { const payload = await response.json() as { error?: { code?: string } }; providerCode = payload.error?.code; } catch { /* optional provider error body */ }
            throw new LlmClientError({ kind: classified.kind, message: "LLM provider request failed with HTTP " + response.status + ".", retryable: classified.retryable, status: response.status, providerCode });
          }
          const payload = await response.json() as { model?: string; choices?: Array<{ message?: { content?: unknown } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
          const content = payload.choices?.[0]?.message?.content;
          if (typeof content !== "string") throw new LlmClientError({ kind: "INVALID_RESPONSE", message: "LLM provider returned no textual assistant content.", retryable: false });
          const result: LlmResponse = { content, model: typeof payload.model === "string" ? payload.model : config.model, latencyMs: Date.now() - started, promptTokens: payload.usage?.prompt_tokens, completionTokens: payload.usage?.completion_tokens, totalTokens: payload.usage?.total_tokens };
          await auditWriter({ audit: request.audit, model: result.model, requestMessages: request.messages, responseContent: result.content, latencyMs: result.latencyMs, promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens, success: true });
          return result;
        } catch (error) {
          const normalized = error instanceof LlmClientError ? error : error instanceof DOMException && error.name === "AbortError" ? new LlmClientError({ kind: "TIMEOUT", message: "LLM provider request timed out.", retryable: true }) : new LlmClientError({ kind: "NETWORK", message: "LLM provider network request failed.", retryable: true });
          lastError = normalized;
          if (!normalized.retryable || attempt >= maxAttempts) {
            try { await auditWriter({ audit: request.audit, model: config.model, requestMessages: request.messages, responseContent: null, latencyMs: Date.now() - started, success: false, errorKind: normalized.kind }); }
            catch { throw new LlmClientError({ kind: "AUDIT_FAILED", message: "LLM failure audit could not be persisted.", retryable: false }); }
            throw normalized;
          }
          await sleep(BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]);
        } finally { clearTimeout(timer); }
      }
      throw lastError ?? new LlmClientError({ kind: "UNKNOWN", message: "LLM request failed.", retryable: false });
    },
  };
}
