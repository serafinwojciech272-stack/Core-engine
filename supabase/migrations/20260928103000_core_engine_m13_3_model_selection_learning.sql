create table if not exists public.ce_intelligence_model_performance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  model_key text not null,
  task_class text not null,
  outcome_quality text not null check (outcome_quality in ('VERIFIED','NEGATIVE','UNVERIFIED')),
  success boolean,
  confidence numeric,
  latency_ms integer,
  cost_units numeric,
  evidence jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ce_intelligence_model_perf_tenant_task_idx on public.ce_intelligence_model_performance(tenant_id, task_class, created_at desc);
create index if not exists ce_intelligence_model_perf_model_idx on public.ce_intelligence_model_performance(tenant_id, model_key, task_class, created_at desc);
alter table public.ce_intelligence_model_performance enable row level security;
revoke all on public.ce_intelligence_model_performance from anon, authenticated;
grant all on public.ce_intelligence_model_performance to service_role;
