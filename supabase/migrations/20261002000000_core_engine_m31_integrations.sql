create table if not exists public.ce_integration_definitions (
 integration_id text primary key, tenant_id uuid not null, provider text not null, version text not null, contract_version text not null,
 status text not null check (status in ('ENABLED','DISABLED','DEGRADED','BLOCKED')), allowed_actions jsonb not null default '[]'::jsonb,
 risk_level text not null check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')), rate_limit_per_minute integer not null check (rate_limit_per_minute > 0),
 timeout_ms integer not null check (timeout_ms > 0), retry_limit integer not null check (retry_limit >= 0), created_at timestamptz not null default now()
);
create table if not exists public.ce_integration_credentials (
 credential_id text primary key, integration_id text not null references public.ce_integration_definitions(integration_id), tenant_id uuid not null,
 secret_ref text not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.ce_integration_invocations (
 invocation_id text primary key, integration_id text not null references public.ce_integration_definitions(integration_id), tenant_id uuid not null,
 actor_id text not null, action text not null, request_hash text not null, idempotency_key text not null, started_at timestamptz not null,
 unique (tenant_id,idempotency_key)
);
create table if not exists public.ce_integration_results (
 invocation_id text primary key references public.ce_integration_invocations(invocation_id), status text not null check (status in ('COMPLETED','FAILED','TIMEOUT','UNKNOWN')),
 response_hash text, provider_request_id text, retryable boolean not null default false, normalized_error text, recorded_at timestamptz not null default now()
);
alter table public.ce_integration_definitions enable row level security;
alter table public.ce_integration_credentials enable row level security;
alter table public.ce_integration_invocations enable row level security;
alter table public.ce_integration_results enable row level security;
revoke all on public.ce_integration_definitions, public.ce_integration_credentials, public.ce_integration_invocations, public.ce_integration_results from anon, authenticated;
grant all on public.ce_integration_definitions, public.ce_integration_credentials, public.ce_integration_invocations, public.ce_integration_results to service_role;
