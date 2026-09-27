-- M9.1 commercial tenant runtime
create table if not exists public.ce_tenants (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ce_mission_tenants (
  mission_id uuid primary key references public.ce_missions(id) on delete cascade,
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ce_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid null references public.ce_missions(id) on delete set null,
  actor_id text not null,
  event_type text not null,
  units integer not null default 1 check (units > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ce_mission_tenants_tenant_idx on public.ce_mission_tenants(tenant_id);
create index if not exists ce_usage_events_tenant_created_idx on public.ce_usage_events(tenant_id, created_at desc);

alter table public.ce_tenants enable row level security;
alter table public.ce_mission_tenants enable row level security;
alter table public.ce_usage_events enable row level security;
