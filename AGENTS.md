# Core Engine engineering contract
- Node >=22.13.0; Next 16.3.5; React 19.3.0; TypeScript 7.0.2.
- Run npm ci, npm run typecheck, npm run lint, npm test, npm run build.
- Mutating API routes require JSON, same-origin requests and production authentication unless CORE_ENGINE_ALLOW_ANONYMOUS=true.
- Supabase is the durable production path. In-memory mode is demo/development only and must be labelled non-durable.
- Trading risk decisions remain deterministic and fail closed.
- Never expose service-role secrets to client bundles.
- Cognition LLM configuration is server-only: CORE_ENGINE_LLM_BASE_URL, CORE_ENGINE_LLM_API_KEY, CORE_ENGINE_LLM_MODEL.
- Every configured LLM call requires durable tenant-scoped audit persistence in ce_cognition_audit_events.
- LLM synthesis may change only natural-language diagnosis/recommendation; it must not alter confidence, probabilities, expectedR, riskGate or deterministic decision fields.
- Learning output is a draft and requires human approval before durable promotion.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
