import test from "node:test";
import assert from "node:assert/strict";
import { createLlmClient, LlmClientError } from "@/lib/cognition/llm-client";
import { getCognitionPrompt, renderCognitionPrompt } from "@/lib/cognition/prompt-registry";

function configured() {
  process.env.CORE_ENGINE_LLM_BASE_URL = "https://llm.example/v1";
  process.env.CORE_ENGINE_LLM_API_KEY = "test-secret";
  process.env.CORE_ENGINE_LLM_MODEL = "test-model";
}

test("prompt registry is versioned and hashed", () => {
  const prompt = getCognitionPrompt("DECIDE");
  assert.equal(prompt.version, "1.0.0");
  assert.equal(prompt.hash.length, 64);
  assert.equal(renderCognitionPrompt("DECIDE", { decision: "{}", context: "{}" }).messages.length, 2);
});

test("LLM client fails closed when unconfigured", async () => {
  delete process.env.CORE_ENGINE_LLM_BASE_URL;
  delete process.env.CORE_ENGINE_LLM_API_KEY;
  delete process.env.CORE_ENGINE_LLM_MODEL;
  const client = createLlmClient({ auditWriter: async () => undefined });
  await assert.rejects(() => client.complete({
    messages: [{ role: "user", content: "x" }],
    audit: { tenantId: "tenant", operation: "test", promptName: "DECIDE", promptVersion: "1.0.0", promptHash: "h" },
  }), (error: unknown) => error instanceof LlmClientError && error.kind === "NOT_CONFIGURED");
});

test("LLM client parses compatible response and audits it", async () => {
  configured();
  let audited = false;
  const client = createLlmClient({
    fetchImpl: async () => new Response(JSON.stringify({ model: "test-model", choices: [{ message: { content: "hello" } }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } }), { status: 200 }),
    auditWriter: async (input) => { audited = input.success && input.responseContent === "hello" && input.totalTokens === 14; },
  });
  const result = await client.complete({
    messages: [{ role: "user", content: "x" }],
    audit: { tenantId: "tenant", operation: "test", promptName: "DECIDE", promptVersion: "1.0.0", promptHash: "h" },
  });
  assert.equal(result.content, "hello");
  assert.equal(result.totalTokens, 14);
  assert.equal(audited, true);
});

test("LLM client retries rate limits", async () => {
  configured();
  let calls = 0;
  const client = createLlmClient({
    sleep: async () => undefined,
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return new Response("", { status: 429 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    },
    auditWriter: async () => undefined,
  });
  const result = await client.complete({
    messages: [{ role: "user", content: "x" }],
    audit: { tenantId: "tenant", operation: "test", promptName: "DECIDE", promptVersion: "1.0.0", promptHash: "h" },
  });
  assert.equal(result.content, "ok");
  assert.equal(calls, 2);
});

test("LLM client does not retry authentication errors", async () => {
  configured();
  let calls = 0;
  const client = createLlmClient({
    sleep: async () => undefined,
    fetchImpl: async () => { calls++; return new Response("", { status: 401 }); },
    auditWriter: async () => undefined,
  });
  await assert.rejects(() => client.complete({
    messages: [{ role: "user", content: "x" }],
    audit: { tenantId: "tenant", operation: "test", promptName: "DECIDE", promptVersion: "1.0.0", promptHash: "h" },
  }), (error: unknown) => error instanceof LlmClientError && error.kind === "AUTH");
  assert.equal(calls, 1);
});

test("LLM client does not expose API key to audit writer", async () => {
  configured();
  let auditRequest = "";
  const client = createLlmClient({
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }),
    auditWriter: async (input) => { auditRequest = JSON.stringify(input); },
  });
  await client.complete({
    messages: [{ role: "user", content: "x" }],
    audit: { tenantId: "tenant", operation: "test", promptName: "DECIDE", promptVersion: "1.0.0", promptHash: "h" },
  });
  assert.equal(auditRequest.includes("test-secret"), false);
});
