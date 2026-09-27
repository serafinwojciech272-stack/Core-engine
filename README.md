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

## M8.4 execution failure semantics

Capability execution reports an explicit, deterministic status. These are not a second state machine: they describe one capability execution inside the existing Mission lifecycle (APPROVE → EXECUTE → MEASURE → LEARN).

| Status | Meaning | HTTP |
| --- | --- | --- |
| `EXECUTED` | Adapter completed | 200 |
| `NOT_FOUND` | Capability action is not registered | 404 |
| `APPROVAL_REQUIRED` | Explicit capability approval is missing | 403 |
| `ADAPTER_NOT_FOUND` | No registered adapter supports the action | 501 |
| `IDEMPOTENCY_CONFLICT` | Key reused for a different request, or in flight | 409 |
| `BLOCKED` | Deterministic refusal to retry (non-retryable or unknown side effect) | 409 |
| `RETRYABLE` | Transient failure that may be retried | 502 |
| `FAILED` | Non-retryable failure that requires human review | 502 |

Every execution produces a persistent receipt carrying `missionId`, `capabilityActionId`, `adapterId`, `executionId`, `attempt`, `status`, `startedAt`, `completedAt`, `sideEffect`, `sideEffectStatus`, `retryable`, `observationalOnly`, an optional `error { category, message, retryable }`, and the adapter `output`.

Failure classification is centralised:

- `EXECUTION_TIMEOUT` and generic adapter faults are transient and may be retried.
- Deterministic adapter input/permission errors (`PRIVATE_URL_BLOCKED`, `WEBHOOK_TARGET_NOT_ALLOWLISTED`, …) are `FAILED` and never retried automatically.
- A timeout on a side-effecting adapter reports `sideEffectStatus: UNKNOWN` and is `BLOCKED`, because an automatic retry could duplicate the side effect.
- A failed attempt that already produced a side effect is never auto-retried.

Idempotency is evaluated before approval, so a replayed request cannot be turned into a fresh execution by re-supplying approval. Replaying a successful execution returns the original receipt with `duplicate: true` and `sideEffect: false`. Observational-only adapters are rejected if they report a side effect (fail closed). Adapter error messages are redacted for bearer tokens, provider keys, query-string secrets, and JWTs before they reach a receipt or an API response.

The capability execution endpoint (`/api/capabilities/actions`) returns `{ ok, error, receipt, retryBlocked }` using the status above. Approval remains mandatory where a capability requires it, and execution never bypasses the Mission approval gate.
