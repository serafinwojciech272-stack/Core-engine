create table if not exists public.ce_world_entities (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  entity_type text not null, canonical_name text not null, attributes jsonb not null default '{}'::jsonb,
  status text not null default 'ACTIVE', confidence numeric, source text, source_ref text, observed_at timestamptz,
  valid_from timestamptz not null default now(), valid_until timestamptz, supersedes_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tenant_id,entity_type,canonical_name)
);
create table if not exists public.ce_world_claims (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  subject_entity_id uuid, subject_key text not null, predicate text not null, object_value jsonb not null,
  value_type text not null default 'JSON', domain text, confidence numeric, source text, source_ref text,
  observed_at timestamptz, valid_from timestamptz not null default now(), valid_until timestamptz,
  status text not null default 'ACTIVE', supersedes_id uuid, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ce_world_unknowns (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  domain text not null, question text not null, key text not null, importance text not null default 'MEDIUM',
  status text not null default 'OPEN', evidence_needed jsonb not null default '[]'::jsonb,
  discovered_from jsonb not null default '{}'::jsonb, confidence numeric, resolved_by_claim_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz,
  unique(tenant_id,domain,key)
);
create table if not exists public.ce_world_contradictions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  subject_key text not null, predicate text not null, claim_a_id uuid not null, claim_b_id uuid not null,
  conflict_type text not null default 'VALUE_MISMATCH', status text not null default 'OPEN',
  resolution text, winning_claim_id uuid, confidence numeric, detected_at timestamptz not null default now(),
  resolved_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  unique(tenant_id,claim_a_id,claim_b_id)
);
create table if not exists public.ce_world_provenance (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  claim_id uuid, memory_id uuid, experience_id uuid, source_type text not null, source text not null,
  source_ref text, source_uri text, source_hash text, collector text, observed_at timestamptz,
  ingested_at timestamptz not null default now(), freshness_at timestamptz,
  authority numeric not null default .5, reliability numeric not null default .5, independence numeric not null default .5,
  completeness numeric not null default .5, directness numeric not null default .5, confidence numeric not null default .5,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.ce_world_state_snapshots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  domain text not null, state jsonb not null default '{}'::jsonb, completeness numeric not null default 0,
  confidence numeric not null default 0, claim_count integer not null default 0, unknown_count integer not null default 0,
  contradiction_count integer not null default 0, generated_at timestamptz not null default now(),
  model_version text not null default 'm10.2', metadata jsonb not null default '{}'::jsonb
);
create index if not exists ce_world_claims_lookup_idx on public.ce_world_claims(tenant_id,subject_key,predicate,status);
create index if not exists ce_world_claims_domain_idx on public.ce_world_claims(tenant_id,domain,status,observed_at desc);
create index if not exists ce_world_claims_freshness_idx on public.ce_world_claims(tenant_id,valid_until,observed_at desc);
create index if not exists ce_world_unknowns_open_idx on public.ce_world_unknowns(tenant_id,status,importance);
create index if not exists ce_world_contradictions_open_idx on public.ce_world_contradictions(tenant_id,status,detected_at desc);
create index if not exists ce_world_snapshots_tenant_domain_idx on public.ce_world_state_snapshots(tenant_id,domain,generated_at desc);
alter table public.ce_world_entities enable row level security;
alter table public.ce_world_claims enable row level security;
alter table public.ce_world_unknowns enable row level security;
alter table public.ce_world_contradictions enable row level security;
alter table public.ce_world_provenance enable row level security;
alter table public.ce_world_state_snapshots enable row level security;
revoke all on public.ce_world_entities,public.ce_world_claims,public.ce_world_unknowns,public.ce_world_contradictions,public.ce_world_provenance,public.ce_world_state_snapshots from anon,authenticated;
grant all on public.ce_world_entities,public.ce_world_claims,public.ce_world_unknowns,public.ce_world_contradictions,public.ce_world_provenance,public.ce_world_state_snapshots to service_role;