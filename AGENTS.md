# Core Engine engineering contract
- Node >=22.13.0; Next 16.3.5; React 19.3.0; TypeScript 7.0.2.
- Run npm ci, npm run typecheck, npm run lint, npm test, npm run build.
- Mutating API routes require JSON, same-origin requests and production authentication unless CORE_ENGINE_ALLOW_ANONYMOUS=true.
- Supabase is the durable production path. In-memory mode is demo/development only and must be labelled non-durable.
- Trading risk decisions remain deterministic and fail closed.
- Never expose service-role secrets to client bundles.
