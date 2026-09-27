-- M9.2 SaaS identity, organizations/workspaces and usage limits
create table if not exists public.ce_tenant_members (
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id,user_id)
);
create table if not exists public.ce_workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  slug text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id,slug)
);
create table if not exists public.ce_workspace_members (
  workspace_id uuid not null references public.ce_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create table if not exists public.ce_billing_accounts (
  tenant_id uuid primary key references public.ce_tenants(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','starter','growth','enterprise')),
  status text not null default 'active' check (status in ('trialing','active','past_due','canceled')),
  monthly_unit_limit bigint not null default 100 check (monthly_unit_limit >= 0),
  provider text not null default 'internal',
  external_customer_id text,
  external_subscription_id text,
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  updated_at timestamptz not null default now()
);
create table if not exists public.ce_usage_periods (
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  period_start timestamptz not null,
  units_used bigint not null default 0 check (units_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id,period_start)
);
create index if not exists ce_tenant_members_user_idx on public.ce_tenant_members(user_id);
create index if not exists ce_workspaces_tenant_idx on public.ce_workspaces(tenant_id);
create index if not exists ce_workspace_members_user_idx on public.ce_workspace_members(user_id);
create index if not exists ce_usage_periods_tenant_idx on public.ce_usage_periods(tenant_id,period_start desc);
alter table public.ce_tenant_members enable row level security;
alter table public.ce_workspaces enable row level security;
alter table public.ce_workspace_members enable row level security;
alter table public.ce_billing_accounts enable row level security;
alter table public.ce_usage_periods enable row level security;
create policy ce_tenant_members_deny_all on public.ce_tenant_members for all to public using (false) with check (false);
create policy ce_workspaces_deny_all on public.ce_workspaces for all to public using (false) with check (false);
create policy ce_workspace_members_deny_all on public.ce_workspace_members for all to public using (false) with check (false);
create policy ce_billing_accounts_deny_all on public.ce_billing_accounts for all to public using (false) with check (false);
create policy ce_usage_periods_deny_all on public.ce_usage_periods for all to public using (false) with check (false);
create or replace function public.ce_consume_usage(p_tenant_id uuid,p_units bigint,p_period_start timestamptz default date_trunc('month',now()))
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_limit bigint; v_used bigint; v_status text;
begin
 if p_units<=0 then raise exception 'USAGE_UNITS_INVALID'; end if;
 select monthly_unit_limit,status into v_limit,v_status from public.ce_billing_accounts where tenant_id=p_tenant_id for update;
 if not found then
   insert into public.ce_billing_accounts(tenant_id) values(p_tenant_id) on conflict (tenant_id) do nothing;
   select monthly_unit_limit,status into v_limit,v_status from public.ce_billing_accounts where tenant_id=p_tenant_id for update;
 end if;
 select coalesce(units_used,0) into v_used from public.ce_usage_periods where tenant_id=p_tenant_id and period_start=p_period_start for update;
 v_used:=coalesce(v_used,0);
 if v_status in ('canceled','past_due') or v_used+p_units>v_limit then
   return jsonb_build_object('allowed',false,'used',v_used,'limit',v_limit,'status',v_status);
 end if;
 insert into public.ce_usage_periods(tenant_id,period_start,units_used,updated_at) values(p_tenant_id,p_period_start,p_units,now())
 on conflict(tenant_id,period_start) do update set units_used=public.ce_usage_periods.units_used+excluded.units_used,updated_at=now();
 return jsonb_build_object('allowed',true,'used',v_used+p_units,'limit',v_limit,'status',v_status);
end;
$$;
revoke execute on function public.ce_consume_usage(uuid,bigint,timestamptz) from public,anon,authenticated;