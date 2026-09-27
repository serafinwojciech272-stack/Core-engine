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

## M9 adapter boundary

The adapter boundary is a contract and policy layer over the existing adapter registry. It does not execute adapters and does not introduce a second state machine. Before any external call it answers three deterministic questions:

1. Is a supporting adapter registered?
2. Are the credentials the adapter declares actually configured?
3. Which timeout, retry and permission policy applies?

Every adapter has a boundary descriptor exposed by `GET /api/capabilities/actions`:

```json
{
  "adapterId": "core.webhook.v1",
  "observationalOnly": false,
  "health": "READY",
  "policy": { "permission": "MUTATE", "timeoutMs": 15000, "maxAttempts": 1, "retryable": false },
  "credentials": [{ "key": "webhook-allowlist", "required": true, "configured": true }]
}
```

Credential requirements name the environment variable that holds a secret. Only whether it is configured is ever reported; the value is never read into a record, logged, or serialised through the API.

Deterministic controls:

- Adapter registry and resolution: specialised adapters win over the simulation fallback; removing the last supporting adapter reports `ADAPTER_NOT_FOUND`.
- Credential boundary: an adapter with an unmet required credential reports `ADAPTER_UNCONFIGURED` and is refused with `FAILED`/`EXECUTION_BLOCKED` before any network call.
- Permission policy: read-only adapters are `OBSERVE`; the webhook adapter is `MUTATE`.
- Timeout policy: the boundary supplies the execution timeout.
- Retry policy: bounded by `maxAttempts`; mutating adapters are not auto-retryable. An exhausted budget reports `BLOCKED`.
- Idempotency, receipts, failure classification and auditability are provided by M8.4, unchanged.

No secrets are stored in source and no credentials are exposed through API responses.

## M9.1 execution evidence and outcome

A successful capability execution is linked to the existing evidence and outcome infrastructure. This does not create a second measurement or learning engine: it produces evidence and an outcome record that the existing layers consume.

```
EXECUTION -> RECEIPT -> EVIDENCE -> OUTCOME -> MEASUREMENT -> LEARNING EVENT
```

- Evidence is produced only for `EXECUTED` executions; a failed, blocked or missing-adapter execution produces no positive evidence, so it can never be mistaken for a measured win.
- Evidence identifies its source execution through `metadata.sourceExecutionId` (plus capability action, adapter, receipt status and side effect status) and carries a deterministic id and provenance hash.
- The outcome identifies mission, capability/action, execution, expected result, actual result, delta and timestamp.
- The outcome assessment and learning event reuse the existing `outcome-quality` and `learning-engine` infrastructure; a missing actual value is `UNVERIFIED` rather than a fabricated win.

Over HTTP, `POST /api/mission` with `action: execute` and a `capabilityActionId` returns `evidence` and `outcome` alongside the receipt. A failed execution returns the receipt and never evidence.

## M9.2 end-to-end lifecycle

The complete loop is covered by the integration test `M9.2 signal to next decision end-to-end lifecycle is covered` in `test/lifecycle-api-integration.test.ts`:

```
SIGNAL -> DIAGNOSIS -> PRIORITY -> RECOMMENDATION -> DECISION -> MISSION
-> APPROVAL -> CAPABILITY APPROVAL -> ADAPTER -> EXECUTION -> RECEIPT
-> EVIDENCE -> OUTCOME -> LEARNING -> NEXT DECISION
```

The test asserts, over real HTTP against a running server:

- `POST /api/engine` produces a diagnosis, a recommendation, a decision and an `AWAITING_APPROVAL` mission.
- Capability approval is recorded before execution and advances the mission to `APPROVED` through the existing state machine.
- Execution resolves an adapter, produces an `EXECUTED` receipt and returns evidence and an outcome whose `sourceExecutionId` and `executionId` link back to that receipt.
- Measurement, completion and learning follow the same mission to `LEARNED`.
- A second `POST /api/engine` produces a distinct mission, closing the loop to the next decision.
- The finished mission is observable through `GET /api/mission`.
