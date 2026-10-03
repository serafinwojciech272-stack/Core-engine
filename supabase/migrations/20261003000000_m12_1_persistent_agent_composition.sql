create table if not exists public.ce_agent_compositions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  mission_id uuid null references public.ce_missions(id) on delete set null,
  agent_id text not null,
  skill_id text not null,
  skill_version text not null,
  capability_id text not null,
  mode text not null check (mode in ('OBSERVATIONAL','SIMULATION','SHADOW','LIVE')),
  status text not null default 'PENDING_APPROVAL'
    check (status in ('PENDING_APPROVAL','APPROVED','REJECTED','EXECUTED','VERIFIED','CLOSED')),
  correlation_id text not null,
  composition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ce_agent_compositions_tenant_idx
  on public.ce_agent_compositions(tenant_id, created_at desc);
create index if not exists ce_agent_compositions_mission_idx
  on public.ce_agent_compositions(mission_id);
create unique index if not exists ce_agent_compositions_correlation_uidx
  on public.ce_agent_compositions(correlation_id);

create table if not exists public.ce_agent_approvals (
  id uuid primary key default gen_random_uuid(),
  composition_id uuid not null references public.ce_agent_compositions(id) on delete cascade,
  tenant_id text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  scope jsonb not null default '[]'::jsonb,
  requested_at timestamptz not null default now(),
  decided_at timestamptz null,
  approved_by text null,
  reason text null,
  correlation_id text not null,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists ce_agent_approvals_composition_uidx
  on public.ce_agent_approvals(composition_id);
create index if not exists ce_agent_approvals_tenant_idx
  on public.ce_agent_approvals(tenant_id, requested_at desc);

alter table public.ce_agent_compositions enable row level security;
alter table public.ce_agent_approvals enable row level security;

revoke all on public.ce_agent_compositions from public, anon, authenticated;
revoke all on public.ce_agent_approvals from public, anon, authenticated;
grant select, insert, update on public.ce_agent_compositions to service_role;
grant select, insert, update on public.ce_agent_approvals to service_role;

create or replace function public.ce_create_agent_composition(
  p_tenant_id text,
  p_agent_id text,
  p_skill_id text,
  p_skill_version text,
  p_capability_id text,
  p_mode text,
  p_correlation_id text,
  p_mission_id uuid default null,
  p_composition jsonb default '{}'::jsonb,
  p_approval_scope jsonb default '[]'::jsonb
) returns table(
  composition_id uuid,
  approval_id uuid,
  status text,
  correlation_id text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  c public.ce_agent_compositions%rowtype;
  a public.ce_agent_approvals%rowtype;
begin
  if nullif(trim(coalesce(p_tenant_id,'')),'') is null then raise exception 'TENANT_ID_REQUIRED'; end if;
  if nullif(trim(coalesce(p_agent_id,'')),'') is null then raise exception 'AGENT_ID_REQUIRED'; end if;
  if nullif(trim(coalesce(p_skill_id,'')),'') is null then raise exception 'SKILL_ID_REQUIRED'; end if;
  if nullif(trim(coalesce(p_capability_id,'')),'') is null then raise exception 'CAPABILITY_ID_REQUIRED'; end if;
  if nullif(trim(coalesce(p_correlation_id,'')),'') is null then raise exception 'CORRELATION_ID_REQUIRED'; end if;
  if p_mode not in ('OBSERVATIONAL','SIMULATION','SHADOW','LIVE') then raise exception 'MODE_INVALID'; end if;

  insert into public.ce_agent_compositions(
    tenant_id,mission_id,agent_id,skill_id,skill_version,capability_id,mode,
    status,correlation_id,composition
  )
  values(
    p_tenant_id,p_mission_id,p_agent_id,p_skill_id,p_skill_version,p_capability_id,p_mode,
    'PENDING_APPROVAL',p_correlation_id,coalesce(p_composition,'{}'::jsonb)
  )
  on conflict (correlation_id) do update
    set updated_at=now()
  returning * into c;

  insert into public.ce_agent_approvals(
    composition_id,tenant_id,status,scope,correlation_id
  )
  values(c.id,c.tenant_id,'PENDING',coalesce(p_approval_scope,'[]'::jsonb),c.correlation_id)
  on conflict (composition_id) do update
    set scope=excluded.scope;

  select * into a from public.ce_agent_approvals where composition_id=c.id;

  return query select c.id,a.id,c.status,c.correlation_id;
end;
$$;

revoke all on function public.ce_create_agent_composition(text,text,text,text,text,text,text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ce_create_agent_composition(text,text,text,text,text,text,text,uuid,jsonb,jsonb) to service_role;

create or replace function public.ce_decide_agent_approval(
  p_composition_id uuid,
  p_status text,
  p_actor_id text,
  p_reason text
) returns table(
  composition_id uuid,
  approval_id uuid,
  approval_status text,
  composition_status text,
  decided_by text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  c public.ce_agent_compositions%rowtype;
  a public.ce_agent_approvals%rowtype;
  next_composition_status text;
begin
  if p_status not in ('APPROVED','REJECTED') then raise exception 'APPROVAL_DECISION_INVALID'; end if;
  if nullif(trim(coalesce(p_actor_id,'')),'') is null then raise exception 'APPROVER_ID_REQUIRED'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'APPROVAL_REASON_REQUIRED'; end if;

  select * into c from public.ce_agent_compositions where id=p_composition_id for update;
  if not found then raise exception 'COMPOSITION_NOT_FOUND'; end if;

  select * into a from public.ce_agent_approvals where composition_id=c.id for update;
  if not found then raise exception 'APPROVAL_OBJECT_NOT_FOUND'; end if;

  if a.status <> 'PENDING' then
    return query select c.id,a.id,a.status,c.status,a.approved_by;
    return;
  end if;

  next_composition_status:=case when p_status='APPROVED' then 'APPROVED' else 'REJECTED' end;

  update public.ce_agent_approvals
  set status=p_status,decided_at=now(),approved_by=p_actor_id,reason=p_reason
  where id=a.id;

  update public.ce_agent_compositions
  set status=next_composition_status,updated_at=now()
  where id=c.id;

  return query select c.id,a.id,p_status,next_composition_status,p_actor_id;
end;
$$;

revoke all on function public.ce_decide_agent_approval(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ce_decide_agent_approval(uuid,text,text,text) to service_role;
