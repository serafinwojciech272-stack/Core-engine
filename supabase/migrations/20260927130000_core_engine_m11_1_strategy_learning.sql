create table if not exists public.ce_intelligence_strategies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  name text not null,
  domain text,
  problem_pattern text not null,
  description text not null,
  steps jsonb not null default '[]'::jsonb,
  applicability_conditions jsonb not null default '[]'::jsonb,
  failure_conditions jsonb not null default '[]'::jsonb,
  source_experience_ids jsonb not null default '[]'::jsonb,
  evidence_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  success_rate numeric(6,5),
  avg_delta_pct numeric,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'EXPERIMENTAL' check (status in ('EXPERIMENTAL','ACTIVE','DEPRECATED')),
  version integer not null default 1,
  supersedes_id uuid references public.ce_intelligence_strategies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name, version)
);
create index if not exists ce_intel_strat_lookup_idx on public.ce_intelligence_strategies(tenant_id,domain,status,confidence desc);
create index if not exists ce_intel_strat_problem_idx on public.ce_intelligence_strategies(tenant_id,problem_pattern);
alter table public.ce_intelligence_strategies enable row level security;
revoke all on public.ce_intelligence_strategies from anon, authenticated;
grant all on public.ce_intelligence_strategies to service_role;