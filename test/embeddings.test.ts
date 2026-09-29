import test from "node:test";
import assert from "node:assert/strict";
import { embedTexts, EmbeddingClientError } from "../lib/memory/embeddings.ts";

test("embedding client fails closed when provider is not configured", async () => {
  delete process.env.CORE_ENGINE_EMBEDDING_BASE_URL;
  delete process.env.CORE_ENGINE_EMBEDDING_API_KEY;
  delete process.env.CORE_ENGINE_LLM_BASE_URL;
  delete process.env.CORE_ENGINE_LLM_API_KEY;

  await assert.rejects(() => embedTexts(["hello"]), (error: unknown) => {
    return error instanceof EmbeddingClientError && error.kind === "NOT_CONFIGURED";
  });
});

test("embedding client batches and retries rate limits", async () => {
  process.env.CORE_ENGINE_EMBEDDING_BASE_URL = "https://example.test";
  process.env.CORE_ENGINE_EMBEDDING_API_KEY = "test-key";
  process.env.CORE_ENGINE_EMBEDDING_MODEL = "test-embedding";
  process.env.CORE_ENGINE_EMBEDDING_DIMENSIONS = "1536";

  let calls = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls++;
    if (calls === 1) return new Response("", { status: 429 });
    const body = JSON.parse(String(init?.body)) as { input: string[] };
    return new Response(JSON.stringify({
      data: body.input.map((_, index) => ({ index, embedding: Array.from({ length: 1536 }, () => index + 0.1) })),
      usage: { total_tokens: 3 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const vectors = await embedTexts(["a", "b"], { fetchImpl, batchSize: 2 });
  assert.equal(calls, 2);
  assert.equal(vectors.length, 2);
  assert.equal(vectors[0].length, 1536);
  delete process.env.CORE_ENGINE_EMBEDDING_BASE_URL;
  delete process.env.CORE_ENGINE_EMBEDDING_API_KEY;
});
