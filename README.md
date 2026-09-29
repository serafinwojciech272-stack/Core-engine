# CORE ENGINE

Universal AI Decision & Execution Engine for Business Growth.

Runtime: Observe -> Understand -> Prioritize -> Decide -> Approve -> Execute -> Measure -> Learn.

## Phase A - controlled cognition

The cognition layer adds optional provider-agnostic LLM synthesis without replacing deterministic decision logic.

Required server-side variables: CORE_ENGINE_LLM_BASE_URL, CORE_ENGINE_LLM_API_KEY, CORE_ENGINE_LLM_MODEL.

No SDK is required. The client uses an OpenAI-compatible HTTP chat-completions contract with bounded timeout and retry/backoff.

LLM output may synthesize unstructured understanding, diagnosis/recommendation language and draft lessons. It cannot change deterministic confidence, probabilities, expectedR, riskGate or evidence. Learning drafts always require human approval.

Every configured LLM invocation is durably audited in ce_cognition_audit_events with tenant, mission, prompt/version/hash, model, request, response, latency, token usage and outcome. Secrets are never written to the audit payload.

If LLM configuration is absent, cognition degrades to DETERMINISTIC_RULES; the core engine remains operational.

The cognition.llm.synthesize capability is HIGH risk and remains behind the existing approval gate.

## Phase B - semantic memory

Semantic memory is an optional pgvector-backed retrieval layer over ce_intelligence_memories. Embeddings use an OpenAI-compatible embeddings endpoint with no additional SDK dependency.

Server-side variables: CORE_ENGINE_EMBEDDING_BASE_URL, CORE_ENGINE_EMBEDDING_API_KEY, CORE_ENGINE_EMBEDDING_MODEL, with the cognition LLM base URL/key accepted as provider fallbacks. The current durable schema uses 1536-dimensional vectors and an HNSW cosine index.

If embedding configuration is absent or the provider fails, memory persistence remains durable and recall falls back to the existing deterministic token-overlap ranking. Embedding failures never block memory writes.
