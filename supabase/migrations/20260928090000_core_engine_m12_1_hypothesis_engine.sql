-- M12.1 Hypothesis Engine
create table if not exists public.ce_intelligence_hypotheses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid,
  domain text,
  problem text not null,
  hypothesis text not null,
  rationale text not null,
  assumptions jsonb not null default '[]'::jsonb,
  predictions jsonb not null default '[]'::jsonb,
  experiment_plan jsonb not null default '[]'::jsonb,
  unknown_ids uuid[] not null default '{}',
  evidence_refs jsonb not null default '[]'::jsonb,
  prior_probability numeric,
  confidence numeric,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','TESTING','SUPPORTED','REFUTED','ABANDONED')),
  outcome jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ce_intel_hypotheses_tenant_idx on public.ce_intelligence_hypotheses(tenant_id, created_at desc);
create index if not exists ce_intel_hypotheses_status_idx on public.ce_intelligence_hypotheses(tenant_id, status, updated_at desc);
alter table public.ce_intelligence_hypotheses enable row level security;
revoke all on public.ce_intelligence_hypotheses from anon, authenticated;
grant all on public.ce_intelligence_hypotheses to service_role;
