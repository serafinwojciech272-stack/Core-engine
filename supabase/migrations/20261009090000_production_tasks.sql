create table if not exists public.ce_production_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  idempotency_key text not null,
  title text not null,
  objective text not null,
  state text not null check (state in ('QUEUED','ACCEPTED','RUNNING','VERIFYING','SUCCEEDED','PARTIAL','FAILED','BLOCKED')),
  version integer not null default 1 check (version > 0),
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, id)
);

create index if not exists ce_production_tasks_tenant_updated_idx
  on public.ce_production_tasks (tenant_id, updated_at desc);

alter table public.ce_production_tasks enable row level security;

comment on table public.ce_production_tasks is
  'Durable tenant-scoped M25 production task records. Access is server-mediated using the Supabase service role; never expose the service key to clients.';
