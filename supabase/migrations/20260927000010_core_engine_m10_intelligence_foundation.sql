create table if not exists public.ce_intelligence_memories (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete set null,
  memory_type text not null check (memory_type in ('OBSERVATION','EXPERIENCE','LESSON','STRATEGY','FACT','BELIEF','OPINION','UNKNOWN','CONTRADICTION')),
  title text not null, content text not null, domain text,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text, source_ref text, observed_at timestamptz, valid_from timestamptz not null default now(),
  valid_until timestamptz, supersedes_id uuid references public.ce_intelligence_memories(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUPERSEDED','RETRACTED','UNVERIFIED')),
  tags jsonb not null default '[]'::jsonb, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ce_intel_mem_tenant_type_idx on public.ce_intelligence_memories(tenant_id,memory_type,status,created_at desc);
create index if not exists ce_intel_mem_tenant_domain_idx on public.ce_intelligence_memories(tenant_id,domain,status);
create index if not exists ce_intel_mem_source_idx on public.ce_intelligence_memories(tenant_id,source,source_ref);

create table if not exists public.ce_intelligence_experiences (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete set null, problem text not null, hypothesis text,
  decision text, action text, expected_outcome jsonb not null default '{}'::jsonb, actual_outcome jsonb not null default '{}'::jsonb,
  outcome_quality text not null default 'UNVERIFIED' check (outcome_quality in ('VERIFIED','NEGATIVE','UNVERIFIED')),
  delta numeric, delta_pct numeric, success boolean, failure_reason text, recovery_action text,
  extracted_lessons jsonb not null default '[]'::jsonb, strategy_candidates jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)), created_at timestamptz not null default now()
);
create index if not exists ce_intel_exp_tenant_created_idx on public.ce_intelligence_experiences(tenant_id,created_at desc);
create index if not exists ce_intel_exp_quality_idx on public.ce_intelligence_experiences(tenant_id,outcome_quality,created_at desc);

create table if not exists public.ce_intelligence_relations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  from_memory_id uuid not null references public.ce_intelligence_memories(id) on delete cascade,
  to_memory_id uuid not null references public.ce_intelligence_memories(id) on delete cascade,
  relation_type text not null check (relation_type in ('SUPPORTS','CONTRADICTS','DERIVED_FROM','SIMILAR_TO','APPLIES_TO','REPLACES')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(tenant_id,from_memory_id,to_memory_id,relation_type)
);
create index if not exists ce_intel_rel_from_idx on public.ce_intelligence_relations(tenant_id,from_memory_id);
create index if not exists ce_intel_rel_to_idx on public.ce_intelligence_relations(tenant_id,to_memory_id);
alter table public.ce_intelligence_memories enable row level security;
alter table public.ce_intelligence_experiences enable row level security;
alter table public.ce_intelligence_relations enable row level security;
revoke all on public.ce_intelligence_memories,public.ce_intelligence_experiences,public.ce_intelligence_relations from anon,authenticated;
grant all on public.ce_intelligence_memories,public.ce_intelligence_experiences,public.ce_intelligence_relations to service_role;