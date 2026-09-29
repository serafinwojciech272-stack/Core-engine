create table if not exists public.ce_value_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  baseline_value numeric(18,2) not null,
  target_value numeric(18,2),
  actual_value numeric(18,2),
  investment_value numeric(18,2) not null default 0 check (investment_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ce_value_cases_tenant_idx on public.ce_value_cases(tenant_id,created_at desc);
create index if not exists ce_value_cases_mission_idx on public.ce_value_cases(mission_id);
alter table public.ce_value_cases enable row level security;
create policy ce_value_cases_deny_all on public.ce_value_cases for all to public using (false) with check (false);
