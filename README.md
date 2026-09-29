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
