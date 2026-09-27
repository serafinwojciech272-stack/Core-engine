# CORE ENGINE

### Universal AI Decision & Execution Engine for Business Growth

Core Engine is an agentic business operating system. It exposes an explicit agent contract, a single mission state machine, durable approval controls, capability execution contracts, outcome measurement, and an auditable decision chain.

The production runtime follows:

Observe → Understand → Prioritize → Decide → Approve → Execute → Measure → Learn

## Commercial runtime

M9.2 adds real Supabase identity, tenant and workspace membership, internal plans, monthly usage periods, database-enforced quota consumption, and RLS-backed tenant boundaries.

## M9.3 real integration execution

The engine now exposes the integration.webhook.dispatch capability. It remains behind the existing approval gate and requires an idempotency key. Targets must match CORE_ENGINE_WEBHOOK_ALLOWLIST. Requests support POST, PUT and PATCH, enforce a bounded timeout, send an explicit idempotency header, and optionally include an HMAC SHA-256 signature from CORE_ENGINE_WEBHOOK_SECRET.

The integration adapter returns an execution receipt with HTTP status, request ID and a bounded response sample. The adapter does not follow redirects. Arbitrary targets are rejected.

The architecture remains one engine:

AUTH → TENANT → EXISTING CORE ENGINE → MISSION → APPROVAL → EXECUTION → MEASURE → LEARN

High-risk external actions require explicit approval. Simulation remains the fallback for unsupported actions. The next production gate is a real customer integration demo with Supabase-backed identity and quota, one allowlisted external endpoint, an approved mission, an execution receipt, and a measured outcome.
