create table if not exists public.ce_intelligence_strategy_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  strategy_id uuid references public.ce_intelligence_strategies(id) on delete set null,
  proposal_type text not null check (proposal_type in ('IMPROVEMENT','SPECIALIZATION','DEPRECATION','MERGE')),
  title text not null,
  rationale text not null,
  proposed_changes jsonb not null default '{}'::jsonb,
  expected_impact jsonb not null default '{}'::jsonb,
  confidence numeric,
  evidence_count integer not null default 0,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','SIMULATED','APPROVED','REJECTED','PROMOTED')),
  source_evaluation_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ce_intelligence_strategy_proposals_tenant_idx on public.ce_intelligence_strategy_proposals(tenant_id, created_at desc);
create index if not exists ce_intelligence_strategy_proposals_strategy_idx on public.ce_intelligence_strategy_proposals(strategy_id, created_at desc);
alter table public.ce_intelligence_strategy_proposals enable row level security;
revoke all on public.ce_intelligence_strategy_proposals from anon, authenticated;
grant all on public.ce_intelligence_strategy_proposals to service_role;
