create table if not exists public.ce_intelligence_recovery_patterns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  pattern_key text not null,
  failure_types text[] not null default '{}',
  trigger_signature text not null,
  preconditions jsonb not null default '[]'::jsonb,
  recovery_steps jsonb not null default '[]'::jsonb,
  source_failure_ids uuid[] not null default '{}',
  evidence_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  success_rate numeric(6,5),
  avg_recovery_delta_pct numeric,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'EXPERIMENTAL' check (status in ('EXPERIMENTAL','ACTIVE','DEPRECATED')),
  version integer not null default 1,
  supersedes_id uuid references public.ce_intelligence_recovery_patterns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, pattern_key, version)
);
create index if not exists ce_intel_recovery_patterns_lookup on public.ce_intelligence_recovery_patterns(tenant_id,pattern_key,status);
create index if not exists ce_intel_recovery_patterns_failure on public.ce_intelligence_recovery_patterns(tenant_id,failure_types);
alter table public.ce_intelligence_recovery_patterns enable row level security;
revoke all on public.ce_intelligence_recovery_patterns from anon, authenticated;
grant all on public.ce_intelligence_recovery_patterns to service_role;