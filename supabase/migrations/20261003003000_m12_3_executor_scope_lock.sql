alter table public.ce_agent_execution_authorizations
  add column if not exists skill_id text,
  add column if not exists skill_version text,
  add column if not exists mode text;

drop function if exists public.ce_enforce_agent_execution(uuid,text,uuid,text,text);
create or replace function public.ce_enforce_agent_execution(
  p_composition_id uuid,
  p_tenant_id text,
  p_mission_id uuid,
  p_capability_id text,
  p_correlation_id text,
  p_skill_id text default null,
  p_skill_version text default null,
  p_mode text default null
) returns table(
  allowed boolean,
  reason text,
  composition_status text,
  approval_status text,
  mission_state text,
  authorization_id uuid
)
language plpgsql security definer set search_path=''
as $$
declare
  c public.ce_agent_compositions%rowtype;
  a public.ce_agent_approvals%rowtype;
  m public.ce_missions%rowtype;
  auth_id uuid;
begin
  select * into c from public.ce_agent_compositions
    where id=p_composition_id and tenant_id=p_tenant_id for update;
  if not found then
    return query select false,'COMPOSITION_NOT_FOUND',null,null,null,null;
    return;
  end if;

  select * into a from public.ce_agent_approvals
    where composition_id=c.id for update;
  if not found then
    return query select false,'APPROVAL_OBJECT_NOT_FOUND',c.status,null,null,null;
    return;
  end if;

  select * into m from public.ce_missions
    where id=p_mission_id for update;
  if not found then
    return query select false,'MISSION_NOT_FOUND',c.status,a.status,null,null;
    return;
  end if;

  if c.mission_id is distinct from p_mission_id then
    return query select false,'MISSION_BINDING_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;

  if c.capability_id <> p_capability_id then
    return query select false,'CAPABILITY_SCOPE_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;

  if c.correlation_id <> p_correlation_id or a.correlation_id <> p_correlation_id then
    return query select false,'CORRELATION_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;

  if p_skill_id is not null and c.skill_id <> p_skill_id then
    return query select false,'SKILL_SCOPE_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;

  if p_skill_version is not null and c.skill_version <> p_skill_version then
    return query select false,'SKILL_VERSION_SCOPE_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;

  if p_mode is not null and c.mode <> p_mode then
    return query select false,'MODE_SCOPE_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;

  if a.status <> 'APPROVED' or c.status <> 'APPROVED' then
    return query select false,'APPROVAL_REQUIRED',c.status,a.status,m.state,null;
    return;
  end if;

  if m.state <> 'APPROVED' then
    return query select false,'MISSION_STATE_NOT_APPROVED',c.status,a.status,m.state,null;
    return;
  end if;

  select id into auth_id
    from public.ce_agent_execution_authorizations
    where correlation_id=p_correlation_id and status='AUTHORIZED'
    for update;

  if auth_id is not null then
    if exists (
      select 1 from public.ce_agent_execution_authorizations
      where id=auth_id
        and composition_id=c.id
        and tenant_id=c.tenant_id
        and mission_id=m.id
        and capability_id=c.capability_id
        and coalesce(skill_id,c.skill_id)=c.skill_id
        and coalesce(skill_version,c.skill_version)=c.skill_version
        and coalesce(mode,c.mode)=c.mode
    ) then
      return query select true,'EXECUTION_ALREADY_AUTHORIZED',c.status,a.status,m.state,auth_id;
    end if;
    return query select false,'AUTHORIZATION_SCOPE_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;

  insert into public.ce_agent_execution_authorizations(
    composition_id,tenant_id,mission_id,capability_id,correlation_id,skill_id,skill_version,mode
  )
  values(c.id,c.tenant_id,m.id,c.capability_id,c.correlation_id,c.skill_id,c.skill_version,c.mode)
  returning id into auth_id;

  return query select true,'EXECUTION_AUTHORIZED',c.status,a.status,m.state,auth_id;
end;
$$;

revoke all on function public.ce_enforce_agent_execution(uuid,text,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ce_enforce_agent_execution(uuid,text,uuid,text,text,text,text,text) to service_role;

create index if not exists ce_agent_exec_auth_scope_idx
  on public.ce_agent_execution_authorizations(tenant_id,mission_id,capability_id,status);

drop function if exists public.ce_close_agent_execution(uuid,uuid,boolean,text);
create or replace function public.ce_close_agent_execution(
  p_composition_id uuid,
  p_authorization_id uuid,
  p_success boolean,
  p_reason text default null
) returns table(composition_status text,mission_state text,result text)
language plpgsql security definer set search_path=''
as $$
declare
  c public.ce_agent_compositions%rowtype;
  m public.ce_missions%rowtype;
  a public.ce_agent_execution_authorizations%rowtype;
begin
  select * into a from public.ce_agent_execution_authorizations
    where id=p_authorization_id and composition_id=p_composition_id for update;
  if not found then raise exception 'EXECUTION_AUTHORIZATION_NOT_FOUND'; end if;
  if a.status <> 'AUTHORIZED' then raise exception 'EXECUTION_AUTHORIZATION_NOT_ACTIVE'; end if;

  select * into c from public.ce_agent_compositions where id=p_composition_id for update;
  select * into m from public.ce_missions where id=c.mission_id for update;

  if m.state not in ('EXECUTING','MEASURING') then
    raise exception 'MISSION_STATE_NOT_CLOSABLE';
  end if;

  update public.ce_agent_execution_authorizations
    set status='CONSUMED',consumed_at=now(),
        metadata=jsonb_build_object('success',p_success,'reason',p_reason)
    where id=a.id;

  if p_success then
    update public.ce_agent_compositions set status='EXECUTED',updated_at=now() where id=c.id;
    return query select 'EXECUTED',m.state,'EXECUTION_RECORDED';
  else
    update public.ce_agent_compositions set status='CLOSED',updated_at=now() where id=c.id;
    return query select 'CLOSED',m.state,'EXECUTION_FAILED';
  end if;
end;
$$;

revoke all on function public.ce_close_agent_execution(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.ce_close_agent_execution(uuid,uuid,boolean,text) to service_role;
