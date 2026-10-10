# Core Engine eval harness

Runs concrete tasks against a local production-mode Core Engine and records every LLM/tool call.

- `tasks.json` — task suite with acceptance checks (T01–T11 agent tasks, M01 mission engine).
- `llm-proxy.mjs` — OpenAI-compatible proxy. `EVAL_MODE=mock` gives deterministic scripted answers (zero cost);
  `EVAL_MODE=anthropic` forwards to Anthropic's OpenAI-compatible API with a hard budget (`EVAL_BUDGET_USD`, default 5)
  and a `max_tokens` cap. Weather calls return labelled fixtures.
- `preload.mjs` — loaded into the Next server via `NODE_OPTIONS=--import`; redirects openrouter.ai / api.openai.com /
  api.x.ai / open-meteo to the proxy. Production code is untouched.
- `run.mjs` — starts proxy + `next start`, runs tasks on both paths (`EVAL_PATH=legacy|loop|both`): legacy `/api/agent`
  and the durable loop `/api/agent/runs` (enqueue → poll → approve/reject). Writes `out/report-<mode>.{json,md}`.
- Mock mode for the loop follows `mockPlan`/`mockFinish` in `tasks.json` (a scripted competent model): it proves the
  plumbing (tool choice honoured, artifacts valid, approvals, budgets), not answer quality.

```sh
npm ci && npm run build
EVAL_MODE=mock node eval/run.mjs
ANTHROPIC_API_KEY=... EVAL_MODE=anthropic EVAL_MODEL=<anthropic-model-id> EVAL_BUDGET_USD=5 node eval/run.mjs T02,T05
```
Secrets come only from the environment / `.env`; reports never contain keys.

## UI end-to-end test of the runs panel (`/runs`)
Start the mock proxy and a production build with `AGENT_LLM_BASE_URL` pointing at it (see `run.mjs` for the env), then:
`python3 eval/ui/runs_ui.py http://127.0.0.1:<port> <screenshot-dir> eval/tasks.json`
It logs in with the operator key, runs T12 (code + sandbox) to COMPLETED, opens a workspace file, then runs T11, rejects the
send_email approval and checks the run completes honestly. Requires Python Playwright + Chromium.
