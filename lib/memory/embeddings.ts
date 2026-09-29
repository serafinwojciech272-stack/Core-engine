export type EmbeddingErrorKind =
  | "NOT_CONFIGURED"
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "NETWORK"
  | "BAD_REQUEST"
  | "SERVER"
  | "INVALID_RESPONSE"
  | "DIMENSION_MISMATCH"
  | "UNKNOWN";

export class EmbeddingClientError extends Error {
  readonly kind: EmbeddingErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(kind: EmbeddingErrorKind, message: string, options?: { status?: number; retryable?: boolean }) {
    super(message);
    this.name = "EmbeddingClientError";
    this.kind = kind;
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

type EmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
  maxAttempts: number;
};

type EmbeddingResponse = {
  data?: Array<{ embedding?: unknown; index?: number }>;
  usage?: { prompt_tokens?: number; total_tokens?: number };
};

function config(): EmbeddingConfig {
  const baseUrl = process.env.CORE_ENGINE_EMBEDDING_BASE_URL || process.env.CORE_ENGINE_LLM_BASE_URL;
  const apiKey = process.env.CORE_ENGINE_EMBEDDING_API_KEY || process.env.CORE_ENGINE_LLM_API_KEY;
  const model = process.env.CORE_ENGINE_EMBEDDING_MODEL || "text-embedding-3-small";
  const dimensions = Number(process.env.CORE_ENGINE_EMBEDDING_DIMENSIONS || "1536");

  if (!baseUrl || !apiKey || !model) {
    throw new EmbeddingClientError("NOT_CONFIGURED", "Embedding provider is not configured.");
  }
  if (!Number.isInteger(dimensions) || dimensions !== 1536) {
    throw new EmbeddingClientError("DIMENSION_MISMATCH", "Core Engine semantic memory currently requires 1536-dimensional embeddings.");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model,
    dimensions,
    timeoutMs: Math.max(1000, Number(process.env.CORE_ENGINE_EMBEDDING_TIMEOUT_MS || "30000")),
    maxAttempts: Math.max(1, Math.min(5, Number(process.env.CORE_ENGINE_EMBEDDING_MAX_ATTEMPTS || "3"))),
  };
}

function endpoint(baseUrl: string) {
  return baseUrl.endsWith("/embeddings") ? baseUrl : `${baseUrl}/v1/embeddings`;
}

function classify(status: number): { kind: EmbeddingErrorKind; retryable: boolean } {
  if (status === 401 || status === 403) return { kind: "AUTH", retryable: false };
  if (status === 429) return { kind: "RATE_LIMIT", retryable: true };
  if ([400, 404, 422].includes(status)) return { kind: "BAD_REQUEST", retryable: false };
  if (status >= 500) return { kind: "SERVER", retryable: true };
  return { kind: "UNKNOWN", retryable: false };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function validateResponse(payload: EmbeddingResponse, expected: number): number[][] {
  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new EmbeddingClientError("INVALID_RESPONSE", "Embedding provider returned no vectors.");
  }

  const vectors = payload.data
    .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
    .map(item => Array.isArray(item.embedding) ? item.embedding.map(Number) : []);

  if (vectors.some(vector => vector.length !== expected || vector.some(value => !Number.isFinite(value)))) {
    throw new EmbeddingClientError("DIMENSION_MISMATCH", `Embedding vector must contain exactly ${expected} finite values.`);
  }
  return vectors;
}

async function requestBatch(texts: string[], fetchImpl: typeof fetch, c: EmbeddingConfig): Promise<number[][]> {
  let last: EmbeddingClientError | undefined;

  for (let attempt = 1; attempt <= c.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), c.timeoutMs);
    try {
      const response = await fetchImpl(endpoint(c.baseUrl), {
        method: "POST",
        headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: c.model, input: texts, dimensions: c.dimensions }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const classified = classify(response.status);
        last = new EmbeddingClientError(classified.kind, `Embedding provider returned HTTP ${response.status}.`, {
          status: response.status,
          retryable: classified.retryable,
        });
        if (!classified.retryable || attempt === c.maxAttempts) throw last;
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }

      let payload: EmbeddingResponse;
      try {
        payload = await response.json() as EmbeddingResponse;
      } catch {
        throw new EmbeddingClientError("INVALID_RESPONSE", "Embedding provider returned invalid JSON.");
      }
      return validateResponse(payload, c.dimensions);
    } catch (error) {
      if (error instanceof EmbeddingClientError) {
        last = error;
        if (!error.retryable || attempt === c.maxAttempts) throw error;
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        last = new EmbeddingClientError("TIMEOUT", "Embedding provider request timed out.", { retryable: true });
      } else {
        last = new EmbeddingClientError("NETWORK", "Embedding provider request failed.", { retryable: true });
      }
      if (attempt === c.maxAttempts) throw last;
      await sleep(250 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw last ?? new EmbeddingClientError("UNKNOWN", "Embedding request failed.");
}

export async function embedTexts(
  texts: string[],
  options: { batchSize?: number; fetchImpl?: typeof fetch } = {},
): Promise<number[][]> {
  if (!texts.length) return [];
  const c = config();
  const fetchImpl = options.fetchImpl ?? fetch;
  const batchSize = Math.max(1, Math.min(64, options.batchSize ?? 32));
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize).map(value => value.slice(0, 12000));
    vectors.push(...await requestBatch(batch, fetchImpl, c));
  }
  return vectors;
}

export async function embedText(text: string, options: { fetchImpl?: typeof fetch } = {}) {
  const [vector] = await embedTexts([text], options);
  return vector;
}

export function isEmbeddingConfigured() {
  return Boolean(
    (process.env.CORE_ENGINE_EMBEDDING_API_KEY || process.env.CORE_ENGINE_LLM_API_KEY) &&
    (process.env.CORE_ENGINE_EMBEDDING_BASE_URL || process.env.CORE_ENGINE_LLM_BASE_URL),
  );
}
