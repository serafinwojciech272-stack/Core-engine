-- M12.2 Experiment Engine
create table if not exists public.ce_intelligence_experiments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  hypothesis_id uuid references public.ce_intelligence_hypotheses(id) on delete set null,
  mission_id uuid,
  name text not null,
  baseline jsonb not null default '{}'::jsonb,
  intervention jsonb not null default '{}'::jsonb,
  success_criteria jsonb not null default '[]'::jsonb,
  guardrails jsonb not null default '[]'::jsonb,
  observations jsonb not null default '[]'::jsonb,
  result text not null default 'UNVERIFIED' check (result in ('UNVERIFIED','SUPPORTED','REFUTED','INCONCLUSIVE','ABORTED')),
  effect_size numeric,
  confidence numeric,
  status text not null default 'DESIGNED' check (status in ('DESIGNED','RUNNING','COMPLETED','ABORTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ce_intel_experiments_tenant_idx on public.ce_intelligence_experiments(tenant_id, created_at desc);
create index if not exists ce_intel_experiments_hypothesis_idx on public.ce_intelligence_experiments(hypothesis_id, created_at desc);
alter table public.ce_intelligence_experiments enable row level security;
revoke all on public.ce_intelligence_experiments from anon, authenticated;
grant all on public.ce_intelligence_experiments to service_role;
