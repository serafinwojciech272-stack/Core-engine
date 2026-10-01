create table if not exists public.ce_resource_budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  scope_type text not null,
  scope_id text not null,
  resource_type text not null,
  amount numeric(20,6) not null check (amount >= 0),
  consumed numeric(20,6) not null default 0 check (consumed >= 0),
  reserved numeric(20,6) not null default 0 check (reserved >= 0),
  soft_limit numeric(20,6) not null check (soft_limit >= 0),
  hard_limit numeric(20,6) not null check (hard_limit >= soft_limit),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  version integer not null default 1,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,scope_type,scope_id,resource_type,version)
);
create index if not exists ce_resource_budgets_scope_idx on public.ce_resource_budgets(tenant_id,scope_type,scope_id,resource_type);

create table if not exists public.ce_resource_reservations (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.ce_resource_budgets(id) on delete cascade,
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  resource_type text not null,
  quantity numeric(20,6) not null check (quantity > 0),
  status text not null default 'RESERVED',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(tenant_id,idempotency_key)
);
create index if not exists ce_resource_reservations_active_idx on public.ce_resource_reservations(budget_id,status,expires_at);

create table if not exists public.ce_resource_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete set null,
  execution_id uuid references public.ce_capability_executions(id) on delete set null,
  resource_type text not null,
  quantity numeric(20,6) not null check (quantity >= 0),
  unit text not null,
  provider text,
  tool_id text,
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  unique(tenant_id,idempotency_key)
);

create table if not exists public.ce_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete set null,
  execution_id uuid references public.ce_capability_executions(id) on delete set null,
  resource_type text not null,
  quantity numeric(20,6) not null check (quantity >= 0),
  unit_price numeric(20,8) not null check (unit_price >= 0),
  currency text not null,
  total_cost numeric(20,8) not null check (total_cost >= 0),
  pricing_version text not null,
  estimated boolean not null default false,
  finalized boolean not null default false,
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  unique(tenant_id,idempotency_key)
);

create table if not exists public.ce_agent_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  agent_key text not null,
  name text not null,
  agent_type text not null,
  version text not null,
  status text not null default 'REGISTERED',
  capabilities jsonb not null default '[]'::jsonb,
  max_delegation_depth integer not null default 0 check (max_delegation_depth >= 0),
  max_concurrent_tasks integer not null default 1 check (max_concurrent_tasks > 0),
  created_at timestamptz not null default now(),
  unique(tenant_id,agent_key,version)
);

create table if not exists public.ce_agent_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete cascade,
  delegator_agent_id uuid not null references public.ce_agent_definitions(id) on delete cascade,
  delegate_agent_id uuid not null references public.ce_agent_definitions(id) on delete cascade,
  capabilities jsonb not null default '[]'::jsonb,
  budget_limit numeric(20,6) not null default 0 check (budget_limit >= 0),
  max_risk_level text not null default 'LOW',
  depth integer not null default 0 check (depth >= 0),
  status text not null default 'ACTIVE',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ce_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete cascade,
  workflow_id text not null,
  task_key text not null,
  assigned_agent_id uuid not null references public.ce_agent_definitions(id) on delete restrict,
  parent_task_id uuid references public.ce_agent_tasks(id) on delete set null,
  required_capabilities jsonb not null default '[]'::jsonb,
  status text not null default 'CREATED',
  created_at timestamptz not null default now(),
  unique(tenant_id,task_key)
);

create table if not exists public.ce_knowledge_objects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  knowledge_key text not null,
  source_id text not null,
  source_type text not null,
  content text not null,
  content_hash text not null,
  version integer not null default 1,
  trust_level text not null default 'LIMITED',
  authority numeric(5,2) not null default 0 check (authority >= 0 and authority <= 100),
  source_timestamp timestamptz not null default now(),
  valid_until timestamptz,
  status text not null default 'QUARANTINED',
  created_at timestamptz not null default now(),
  unique(tenant_id,knowledge_key,version)
);
create index if not exists ce_knowledge_objects_retrieval_idx on public.ce_knowledge_objects(tenant_id,status,source_type,source_timestamp desc);

create table if not exists public.ce_context_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete set null,
  task_id uuid references public.ce_agent_tasks(id) on delete set null,
  retrieval_id text not null,
  context_version integer not null default 1,
  context_hash text not null,
  references jsonb not null default '[]'::jsonb,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ce_knowledge_conflicts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  conflict_key text not null,
  knowledge_references jsonb not null default '[]'::jsonb,
  status text not null default 'OPEN',
  severity text not null default 'MEDIUM',
  resolution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tenant_id,conflict_key)
);

do $$ declare t text; begin
  foreach t in array array[
    'ce_resource_budgets','ce_resource_reservations','ce_resource_usage','ce_cost_ledger',
    'ce_agent_definitions','ce_agent_delegations','ce_agent_tasks',
    'ce_knowledge_objects','ce_context_packages','ce_knowledge_conflicts'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
