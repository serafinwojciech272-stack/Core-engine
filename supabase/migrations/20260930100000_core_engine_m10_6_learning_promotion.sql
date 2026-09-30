create table if not exists public.ce_intelligence_lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  candidate_key text not null,
  lesson text not null,
  domain text,
  status text not null default 'CANDIDATE' check (status in ('CANDIDATE','PROMOTED','REJECTED','STALE')),
  evidence_count integer not null default 0,
  support_count integer not null default 0,
  contradiction_count integer not null default 0,
  confidence numeric(5,4) not null default 0 check (confidence >= 0 and confidence <= 1),
  source_experience_ids jsonb not null default '[]'::jsonb,
  source_mission_ids jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  promoted_memory_id uuid references public.ce_intelligence_memories(id) on delete set null,
  first_observed_at timestamptz,
  last_validated_at timestamptz,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,candidate_key)
);
create index if not exists ce_intel_lessons_tenant_status_idx on public.ce_intelligence_lessons(tenant_id,status,confidence desc,updated_at desc);
create index if not exists ce_intel_lessons_tenant_domain_idx on public.ce_intelligence_lessons(tenant_id,domain,status);
alter table public.ce_intelligence_lessons enable row level security;
revoke all on public.ce_intelligence_lessons from anon,authenticated;
grant all on public.ce_intelligence_lessons to service_role;
