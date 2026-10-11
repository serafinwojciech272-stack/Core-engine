# Deploying durable agent runs (ADR-001 phase 2)

## 1. Database
Apply `supabase/migrations/20261010090000_ce_agent_jobs.sql` (table `ce_agent_jobs` + RPC `ce_agent_job_claim`).
RLS denies `anon`/`authenticated`; only the server key (service_role) can read/write.

## 2. Environment (web service and worker — same values)
| Variable | Value |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | existing server credentials → store defaults to `supabase` |
| `AGENT_LLM_MODEL` + `ANTHROPIC_API_KEY` | or `AGENT_LLM_BASE_URL` / `AGENT_LLM_API_KEY` / `AGENT_LLM_MODEL` |
| `AGENT_LLM_PRICE_IN_PER_MTOK`, `AGENT_LLM_PRICE_OUT_PER_MTOK` | model prices for cost accounting (e.g. 2 / 10 for Sonnet 5.5) |
| `AGENT_MAX_COST_PER_RUN_USD` | hard cap per run (default 5) |
| `AGENT_WORKER_MODE` | `external` on the web service when a separate worker runs; `inline` otherwise |
| `CORE_ENGINE_API_KEY` | required to call `/api/agent/runs` (anonymous callers are always rejected) |

## 3. Worker process
Command: `npm run agent:worker` (polls every 2 s, claims with leases; any number of workers is safe).

Options:
- **Render Background Worker** — separate service, same repo, start command `npm run agent:worker`.
  Background workers are not on Render's free tier (check current pricing before creating one).
- **Single paid web instance with `AGENT_WORKER_MODE=inline`** — simplest; runs execute inside the web process.
  On the free web plan the instance sleeps, so runs pause until the next request wakes it (they resume from the last checkpoint).

Example `render.yaml` service (not added automatically to avoid creating a paid service):
```yaml
  - type: worker
    name: core-engine-agent-worker
    runtime: node
    region: frankfurt
    plan: starter
    buildCommand: npm ci
    startCommand: npm run agent:worker
    autoDeploy: true
```

## 4. API
- `POST /api/agent/runs` `{goal, context?, acceptanceCriteria?, budget?}` → 202 `{run, pollUrl}`
- `GET /api/agent/runs/:id` (progress, steps, artifacts, workspace) · `?artifact=<id>` · `?messages=1`
- `POST /api/agent/runs/:id` `{action: approve|reject|cancel|resume, budget?}`

## 5. Local integration test of the Supabase store
Postgres 16 + PostgREST 12 with the migration applied; then:
`AGENT_STORE_PGRST_URL=http://127.0.0.1:54321 AGENT_STORE_PGRST_KEY=<service_role JWT> node --experimental-loader ./scripts/test-loader.mjs --test --experimental-strip-types test/agent-loop-supabase.test.ts`
(against hosted Supabase set `AGENT_STORE_PGRST_PATH=/rest/v1`). Skipped in CI when the variables are absent.

## 6. Code execution (optional, ADR-002)
`AGENT_SANDBOX=local` enables the `run_command` tool on the **worker** only. Optional: `AGENT_SANDBOX_NETWORK=off`,
`AGENT_SANDBOX_MAX_TIMEOUT_MS` (default 300000). Install the runtimes your runs need (python3, node, pytest…) on that host.
Do not enable it on the web service or on a host that holds other secrets/files you care about.

## 7. Local worker on your PC (0 zł, ADR-003)
The free Render web service never executes code. Runs created with "Uruchamiaj kod i testy" (playbook *Moduł z testami*)
carry `requires: ["sandbox"]` and wait in the Supabase queue until a sandbox worker claims them.

1. Apply `supabase/migrations/20261011090000_ce_agent_jobs_capabilities.sql` in the Supabase SQL Editor.
2. In the repo folder put in `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
   `AGENT_LLM_MODEL=claude-sonnet-5-5`, `AGENT_LLM_PRICE_IN_PER_MTOK=2`, `AGENT_LLM_PRICE_OUT_PER_MTOK=10`.
3. `npm install` once, then `npm run agent:worker:local` (Node ≥ 22.9; Python on PATH for Python tasks).
   The first log line shows model, store and `sandbox on`. Stop with Ctrl+C — a run in progress is resumed by the
   next worker after its lease expires.

Security: the worker runs model-written code as your user. Keep it on a machine/account without access to
sensitive files, or run it in a Linux VM/container (full isolation: prlimit + optional `AGENT_SANDBOX_NETWORK=off`).
