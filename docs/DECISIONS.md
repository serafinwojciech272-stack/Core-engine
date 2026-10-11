# Architecture Decision Records

## ADR-001 — Durable agent loop for long runs (2026-10-09)

**Status:** Accepted (phase 1 implemented: memory/file store, inline + external worker). Phase 2 (Supabase store) pending.

### Context
- Goal: the agent must plan and execute long tasks "until done" without a human nudging it every few minutes.
- `/api/agent` is a single synchronous HTTP request: keyword regexes decide whether the model sees tools at all and
  which tool actually runs (the model's tool choice is ignored), at most one tool executes per request, and nothing
  survives a restart. Eval (`eval/`, mock mode) confirmed: semantic tool use (T04), model-supplied tool arguments (T06),
  multi-step (T08), long runs (T10) and side-effect safety (T11 — "send an email" built a website) all fail.
- The deterministic mission engine (`/api/engine`, `/api/mission`) is sound and stays the control plane for business missions.

### Decision
Add a new, separate execution path: `lib/agent-loop/` + `/api/agent/runs`.
1. **Run = persisted record**, not a request. `POST /api/agent/runs` returns 202 + `pollUrl`; a worker executes it.
2. **Loop:** LLM turn → execute the tool calls the model chose (JSON-schema tools, no keyword routing) → checkpoint →
   repeat until the model calls `finish` and the **completion gate** accepts it (every acceptance criterion met with
   evidence; cited `workspace:` files must exist) or a budget is hit.
3. **Checkpoint after every LLM turn and every tool result**, optimistic versioning + worker leases. A crashed worker's
   run is taken over after lease expiry; unanswered tool calls are executed on resume without re-planning.
4. **Budgets per run:** steps, tokens, USD, active wall time, `max_tokens` per call (server-side caps). Exhaustion →
   `BUDGET_EXHAUSTED`, resumable with extra budget.
5. **Side-effect tools pause the run** (`WAITING_APPROVAL`) until a human approves/rejects via API. Missing integrations
   are reported (`EMAIL_INTEGRATION_NOT_CONFIGURED`), never faked.
6. **One LLM gateway** (`lib/agent-loop/llm.ts`): OpenAI-compatible, retries 429/5xx/network with backoff, no retry on
   4xx, cost accounting. Providers: `AGENT_LLM_*`, Anthropic (OpenAI-compatible endpoint) or OpenRouter.
7. **Workers:** `AGENT_WORKER_MODE=inline` (web process drains the queue — dev/single box) or `external`
   (`npm run agent:worker` as a separate long-lived process).

### Alternatives considered
- *Patch `/api/agent` in place* — rejected: the request/response shape cannot carry a multi-hour run, and the
  regex routing is woven through the whole route.
- *Adopt a framework (LangGraph / Claude Agent SDK) now* — deferred. The loop is ~500 lines, fully owned and tested;
  re-evaluate after the real-model eval (if context management or sub-agents become the bottleneck).
- *Queue service (Redis/BullMQ)* — not needed yet; the run table with leases is the queue.

### Consequences / risks
- **Render free plan sleeps** → inline mode loses in-flight work until the next request; leases make it resumable but
  not continuous. Long runs in production need an always-on worker (Render Background Worker or a VPS) and a shared
  store → **Phase 2: `SupabaseRunStore`** (table `ce_agent_jobs`, CAS on `version`, lease columns).
- File store is single-host only (web + worker must share the disk).
- Mock eval proves plumbing, not intelligence; quality numbers require the real-model eval (`EVAL_MODE=anthropic`).
- Legacy `/api/agent` stays untouched for compatibility; deprecate after the loop passes the real-model eval.

### Also fixed in this change
- PDF generator produced damaged files (escaped `\\n` / regex in a non-template string; verified with qpdf). Rewritten:
  valid xref, pagination, escaped text; Polish diacritics transliterated (Type1 font has no glyphs — embed TTF later).
- DOCX generator never split paragraphs (same escaping bug).
- Tenant resolution regex `/^Bearer\\s+/` made every API key resolve to the default tenant; fixed + timing-safe compare + regression test.

### Update 2026-10-09 — real-model eval (claude-sonnet-5-5)
Report: `eval/out/report-anthropic-final.md`. Same model on both paths.

| Path | Passed | Mean score | ≈Cost |
|---|---|---|---|
| legacy `/api/agent` | 6/12 | 0.58 | $0.33 |
| loop `/api/agent/runs` | 10/11 | 0.95 | $0.71 |

- Loop completed the long run T10 (8 files: spec, SQL schema, Flask API, HTML UI, pytest tests, README) in ~155 s / 6 LLM turns / ≈$0.37,
  passing the completion gate. It honestly reported that code was not executed (no code-execution tool yet).
- Legacy failures confirmed with a real model: model asks for the weather tool but nothing runs (T04); website tool aborted at 30 s (T05);
  data question answered with metadata only (T07); OpenRouter tool loop sends parallel tool calls but answers only the first →
  provider 400 (T10); "send an email" builds a website (T11).
- Loop's only failure: T01 uses one LLM call for arithmetic that legacy computes deterministically (acceptable; optional fast path later).

Fixes driven by the real run:
- `max_tokens` per call 4k → 16k and handling of `finish_reason=length` (truncated tool calls are discarded and the model is told to split work).
- Stop-limit counts only *consecutive* text-only turns (announcements between tool batches no longer kill the run).
- Without criteria, a text reply right after a failed tool gets one nudge before being accepted as final.
- `website_build` writes `site/index.html` into the workspace and returns its outline (agent no longer rebuilds blind: T05 cost $0.36 → $0.05).
- `workspace_read` is chunked (5k chars + `nextOffset`).
- `temperature` is omitted (current Claude models reject it); website generator timeout 30 s → 120 s (`WEBSITE_BUILD_TIMEOUT_MS`).

Next: Phase 2 (`SupabaseRunStore` + always-on worker), code-execution sandbox tool (so T10-type runs can run their own tests), P1 auth closure.

### Update 2026-10-10 — Phase 2 implemented + P1 (route auth) closed
- `SupabaseRunStore` (`lib/agent-loop/store.ts`) on table `ce_agent_jobs` (migration `20261010090000`): CAS save via conditional
  PATCH on `(id, version)`, claiming via RPC `ce_agent_job_claim` (`FOR UPDATE SKIP LOCKED`, expired-lease takeover).
  Verified against real Postgres 16 + PostgREST 12: 12 concurrent claimers on 5 jobs → each claimed exactly once; a run paused
  for approval on worker A completes on a fresh worker B. Store auto-selects Supabase when server credentials exist.
- Deployment options in `docs/DEPLOY-AGENT-WORKER.md` (separate worker vs inline on an always-on web instance).
- P1: every API handler now authenticates or is explicitly public (static test `test/route-auth.test.ts`). Closed: public
  `/api/agent`, `/api/integrations` (now per-client secrets), `/api/agent/file`, cross-tenant `intelligence/recall|reflect`
  (tenant only from auth), FCC finance reads (no hardcoded tenant), mission/commercial/saas/program reads, LLM endpoints.
  Anonymous demo mode keeps working but paid LLM calls are capped (per IP/hour + global/day); `/api/agent/runs` never anonymous.
  Production smoke/verifier send the API key and run daily instead of hourly + on every PR.

## ADR-002 — Code execution for the agent loop (2026-10-10)

**Status:** Accepted (local process sandbox, opt-in via `AGENT_SANDBOX=local`).

### Context
Coding runs (T10) produced plausible code but could not run it, so "until done" stopped at "written, not executed".

### Decision
Tool `run_command` (`lib/agent-loop/sandbox.ts`): materialises the run workspace in a fresh temp dir, runs ONE allow-listed
executable (`python3, python, pytest, node, npm, npx, tsc, go, cargo`) with argv (no shell), returns exit code + output
tails, syncs created/changed text files back to the workspace. The system prompt tells the agent to run tests, fix, re-run
until green and cite the passing run in `finish`. Behind the `CodeSandbox` interface so a remote sandbox can replace it.

Isolation of `LocalProcessSandbox` (best-effort): scrubbed env (no secrets reach the code — tested), fresh temp dir + HOME,
timeout with process-group kill (tested), `prlimit` memory/process/file-size limits, optional `unshare -n` network cut-off
(`AGENT_SANDBOX_NETWORK=off`; works only where namespaces are permitted — reported in the tool output).

### Consequences / risks
- It executes model-written code on the host. Enable it **only on a dedicated worker** (never on the web service, never
  with production credentials mounted). For multi-tenant production use a container/microVM sandbox behind the same interface.
- Network is allowed by default (installing test dependencies); turn it off when dependencies are vendored.

### Evidence (real model, claude-sonnet-5-5, `eval/out/report-anthropic-sandbox.md`)
- T12 (invoice module + tests until green): COMPLETED in 3 turns / ≈$0.05; 10 tests; **re-run independently by the harness: exit 0**.
- T10 (reservation app): first test run 1 failed / 30 passed (static file not served) → agent fixed it (incl. path-traversal
  guard) → 31 passed → COMPLETED. 7 turns, ≈$0.43, ~134 s.

## ADR-003 — Playbooks, capability routing and explicit LLM configuration (2026-10-11)

### Context
First production week (rollout notes in the project): operators had to hand-write goals and criteria, every
run ran on whatever worker claimed it (a run that needed code execution could be "completed" by a worker that
cannot run code), and a missing `ANTHROPIC_API_KEY` silently routed `claude-*` model ids to OpenRouter
(HTTP 400 at the first step instead of a clear configuration error).

### Decision
1. **Playbooks** (`lib/agent-loop/playbooks.ts`, `GET /api/agent/playbooks`): server-side, parameterised run
   templates (goal, acceptance criteria, default budget). The client sends `{ playbookId, inputs }`; the server
   validates inputs (required, max length), strips template braces from user text and renders the run. Templates
   never leave the server, so a client cannot alter acceptance criteria of a playbook run. Large pasted data
   (`contextKey`) goes to run context, not into the goal. First set: agent blueprint, CEO execution plan,
   landing page, code module with tests, data insights, gastro growth pack, e-mail campaign, market brief.
2. **Capability routing**: a run may list `requires` (today only `sandbox`). A worker advertises capabilities
   from its tools (`run_command` → `sandbox`) and only claims runs it can serve — memory/file stores filter in
   code, Supabase via `ce_agent_job_claim_v2` (migration `20261011090000`, `requires <@ capabilities`).
   Before the migration the store falls back to the v1 RPC and hands back runs it cannot serve.
   The web service never gets `sandbox`; a worker on a dedicated host or the operator's PC
   (`npm run agent:worker:local`) serves code runs against the same Supabase queue.
3. **Explicit LLM configuration**: `describeLlmConfig()` resolves provider/model without secrets and reports an
   `issue` for configurations that would fail at the first call (native `claude-*` id with only OpenRouter, missing
   model). Such configurations are treated as *not configured*: `POST /api/agent/runs` returns 503 with the reason
   instead of creating a run that fails later. `GET /api/agent/status` exposes provider, model, store, worker mode,
   sandbox and the cost cap; the panel uses it as the login check and shows it as status chips.
4. **Sandbox on Windows** (for the local worker): tree kill via `taskkill /T`, minimal Windows env (no secrets),
   `.cmd` shims (npm/npx/tsc) via cmd.exe only with arguments free of cmd metacharacters.

### Consequences / risks
- Sandbox runs wait in the queue until a capable worker is online; the panel says so explicitly.
- The v1 fallback can hold the oldest sandbox run at the head of a v1 worker's queue for one poll cycle; apply the
  migration to remove it.
- Local-worker isolation on Windows is weaker than on Linux (no prlimit/unshare): run it only on a machine without
  sensitive data in reach of the worker user, or move it to a Linux VM/container.

### Evidence
- Postgres 16: both migrations applied twice (idempotent); a capability-less claim skips a `sandbox` run, a
  `sandbox` worker claims it; v1 RPC still works.
- Tests: 332 total, 0 failing (new: `test/agent-playbooks.test.ts`, 12 cases). Browser E2E (Playwright, mock LLM):
  wrong key rejected at login, playbook → run → COMPLETED, file viewer, filters, duplicate, mobile 390 px without
  horizontal scroll, no page errors.
