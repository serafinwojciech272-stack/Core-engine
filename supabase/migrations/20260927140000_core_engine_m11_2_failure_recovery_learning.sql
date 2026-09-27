create table if not exists public.ce_intelligence_failures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid,
  experience_id uuid references public.ce_intelligence_experiences(id) on delete set null,
  problem text not null,
  failure_type text not null check (failure_type in ('HYPOTHESIS','DATA','INTERPRETATION','DECISION','EXECUTION','TOOL','ENVIRONMENT','DEPENDENCY','UNKNOWN')),
  root_cause text,
  severity text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  failed_action text,
  recovery_action text,
  recovery_result text,
  recovery_success boolean,
  recovery_delta_pct numeric,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence jsonb not null default '[]'::jsonb,
  prevention jsonb not null default '[]'::jsonb,
  status text not null default 'OPEN' check (status in ('OPEN','RECOVERED','UNRESOLVED','PREVENTED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists ce_intel_failures_lookup on public.ce_intelligence_failures(tenant_id,failure_type,status,created_at desc);
create index if not exists ce_intel_failures_problem on public.ce_intelligence_failures(tenant_id,problem);
create index if not exists ce_intel_failures_mission on public.ce_intelligence_failures(tenant_id,mission_id);
alter table public.ce_intelligence_failures enable row level security;
revoke all on public.ce_intelligence_failures from anon, authenticated;
grant all on public.ce_intelligence_failures to service_role;