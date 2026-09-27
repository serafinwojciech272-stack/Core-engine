create table if not exists public.ce_intelligence_knowledge_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  claim_key text not null,
  claim text not null,
  domain text,
  status text not null default 'UNVERIFIED' check (status in ('KNOWN','LOW_CONFIDENCE','UNKNOWN','CONTRADICTORY','STALE','UNVERIFIED')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text,
  source_ref text,
  observed_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz,
  supersedes_id uuid references public.ce_intelligence_knowledge_claims(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, claim_key)
);
create index if not exists ce_intel_claim_tenant_status_idx on public.ce_intelligence_knowledge_claims(tenant_id,status,updated_at desc);
create index if not exists ce_intel_claim_domain_idx on public.ce_intelligence_knowledge_claims(tenant_id,domain,status);

create table if not exists public.ce_intelligence_claim_relations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  from_claim_id uuid not null references public.ce_intelligence_knowledge_claims(id) on delete cascade,
  to_claim_id uuid not null references public.ce_intelligence_knowledge_claims(id) on delete cascade,
  relation_type text not null check (relation_type in ('SUPPORTS','CONTRADICTS','SUPERSEDES','DERIVED_FROM')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tenant_id,from_claim_id,to_claim_id,relation_type)
);
create index if not exists ce_intel_claim_rel_from_idx on public.ce_intelligence_claim_relations(tenant_id,from_claim_id);
create index if not exists ce_intel_claim_rel_to_idx on public.ce_intelligence_claim_relations(tenant_id,to_claim_id);

create table if not exists public.ce_intelligence_unknowns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  question text not null,
  domain text,
  priority integer not null default 50 check (priority between 0 and 100),
  status text not null default 'OPEN' check (status in ('OPEN','RESEARCHING','RESOLVED','WONT_RESOLVE')),
  evidence_required jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  linked_mission_id uuid references public.ce_missions(id) on delete set null,
  resolution jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists ce_intel_unknown_tenant_status_idx on public.ce_intelligence_unknowns(tenant_id,status,priority desc,created_at desc);
create index if not exists ce_intel_unknown_domain_idx on public.ce_intelligence_unknowns(tenant_id,domain,status);

create table if not exists public.ce_intelligence_world_state (
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  domain text not null default 'global',
  version bigint not null default 1,
  goals jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  kpis jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  active_hypotheses jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  knowledge_snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(tenant_id,domain)
);
create index if not exists ce_intel_world_updated_idx on public.ce_intelligence_world_state(tenant_id,updated_at desc);

alter table public.ce_intelligence_knowledge_claims enable row level security;
alter table public.ce_intelligence_claim_relations enable row level security;
alter table public.ce_intelligence_unknowns enable row level security;
alter table public.ce_intelligence_world_state enable row level security;
revoke all on public.ce_intelligence_knowledge_claims,public.ce_intelligence_claim_relations,public.ce_intelligence_unknowns,public.ce_intelligence_world_state from anon,authenticated;
grant all on public.ce_intelligence_knowledge_claims,public.ce_intelligence_claim_relations,public.ce_intelligence_unknowns,public.ce_intelligence_world_state to service_role;