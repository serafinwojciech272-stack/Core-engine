-- M11.5 — Learning Quality & Regression Gate
-- Stores evaluation evidence for strategy promotion/regression decisions.
create table if not exists public.ce_intelligence_learning_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  strategy_id uuid references public.ce_intelligence_strategies(id) on delete set null,
  recovery_pattern_id uuid references public.ce_intelligence_recovery_patterns(id) on delete set null,
  evaluation_type text not null check (evaluation_type in ('BASELINE','REGRESSION','PROMOTION','DEGRADATION')),
  baseline_success_rate numeric,
  candidate_success_rate numeric,
  baseline_avg_delta_pct numeric,
  candidate_avg_delta_pct numeric,
  evidence_count integer not null default 0,
  verdict text not null check (verdict in ('PASS','FAIL','HOLD')),
  reason text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ce_intelligence_learning_evals_tenant_idx
  on public.ce_intelligence_learning_evaluations(tenant_id, created_at desc);
create index if not exists ce_intelligence_learning_evals_strategy_idx
  on public.ce_intelligence_learning_evaluations(strategy_id, created_at desc);
alter table public.ce_intelligence_learning_evaluations enable row level security;
revoke all on public.ce_intelligence_learning_evaluations from anon, authenticated;
grant all on public.ce_intelligence_learning_evaluations to service_role;