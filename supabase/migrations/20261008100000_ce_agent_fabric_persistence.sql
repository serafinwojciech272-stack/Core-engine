create table if not exists public.ce_agent_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  project text not null,
  goal text not null,
  status text not null check (status in ('PLANNED','RUNNING','COMPLETED','FAILED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ce_agent_runs_tenant_project_idx on public.ce_agent_runs(tenant_id, project, created_at desc);
create table if not exists public.ce_agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ce_agent_runs(id) on delete cascade,
  step_index integer not null,
  kind text not null,
  status text not null check (status in ('PENDING','RUNNING','SUCCEEDED','FAILED')),
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists ce_agent_steps_run_idx on public.ce_agent_steps(run_id, step_index);
create table if not exists public.ce_memory (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  project text not null,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  importance numeric not null default 0.5 check (importance >= 0 and importance <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, project, key)
);
create table if not exists public.ce_tool_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  project text not null,
  run_id uuid references public.ce_agent_runs(id) on delete set null,
  tool_id text not null,
  action text not null,
  status text not null,
  approval_required boolean not null default false,
  input jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ce_tool_events_run_idx on public.ce_tool_events(run_id, created_at desc);
create table if not exists public.ce_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  project text not null,
  run_id uuid references public.ce_agent_runs(id) on delete set null,
  score numeric not null check (score >= 0 and score <= 1),
  criteria jsonb not null default '{}'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ce_evaluations_run_idx on public.ce_evaluations(run_id, created_at desc);
create table if not exists public.ce_learning_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  project text not null,
  run_id uuid references public.ce_agent_runs(id) on delete set null,
  signal_type text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ce_learning_signals_project_idx on public.ce_learning_signals(tenant_id, project, created_at desc);
create table if not exists public.ce_optimization_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  project text not null,
  config jsonb not null default '{}'::jsonb,
  objective numeric not null,
  decision text not null,
  created_at timestamptz not null default now()
);
alter table public.ce_agent_runs enable row level security;
alter table public.ce_agent_steps enable row level security;
alter table public.ce_memory enable row level security;
alter table public.ce_tool_events enable row level security;
alter table public.ce_evaluations enable row level security;
alter table public.ce_learning_signals enable row level security;
alter table public.ce_optimization_runs enable row level security;
do $$
declare t text;
begin
  foreach t in array array['ce_agent_runs','ce_agent_steps','ce_memory','ce_tool_events','ce_evaluations','ce_learning_signals','ce_optimization_runs'] loop
    execute format('drop policy if exists %I on public.%I', 'ce_internal_only_'||t, t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (false) with check (false)', 'ce_internal_only_'||t, t);
  end loop;
end $$;