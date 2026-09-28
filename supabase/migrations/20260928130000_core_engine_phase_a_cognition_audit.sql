create table if not exists public.ce_cognition_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id text,
  operation text not null,
  prompt_name text not null,
  prompt_version text not null,
  prompt_hash text not null,
  model text not null,
  request_messages jsonb not null,
  response_content text,
  latency_ms integer not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  success boolean not null,
  error_kind text,
  created_at timestamptz not null default now()
);

alter table public.ce_cognition_audit_events enable row level security;
revoke all on public.ce_cognition_audit_events from anon, authenticated;
grant all on public.ce_cognition_audit_events to service_role;

create index if not exists ce_cognition_audit_tenant_created
  on public.ce_cognition_audit_events (tenant_id, created_at desc);
