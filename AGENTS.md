# Core Engine engineering contract
- Node >=22.13.0; Next 16.3.5; React 19.3.0; TypeScript 7.0.2.
- Run npm ci, npm run typecheck, npm run lint, npm test, npm run build.
- Mutating API routes require JSON, same-origin requests and production authentication unless CORE_ENGINE_ALLOW_ANONYMOUS=true.
- Supabase is the durable production path. In-memory mode is demo/development only and must be labelled non-durable.
- Trading risk decisions remain deterministic and fail closed.
- Never expose service-role secrets to client bundles.
- Cognition is optional and server-side only. Required variables are CORE_ENGINE_LLM_BASE_URL, CORE_ENGINE_LLM_API_KEY and CORE_ENGINE_LLM_MODEL.
- LLM synthesis may change only bounded language fields; deterministic risk, probability, expectedR and evidence fields remain authoritative.
- Every configured LLM call must produce a durable tenant-scoped cognition audit record.
- Learning synthesis is a draft only and requires human approval before learning state changes.
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs and conventions may differ from training data. Read relevant guide in node_modules/next/dist/docs/ before using unknown Next APIs.
<!-- END:nextjs-agent-rules -->
