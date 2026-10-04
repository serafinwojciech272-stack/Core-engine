-- M12.5: executor authorization lease, revocation and replay hardening
-- Authorized execution is a short-lived lease. A consumed authorization remains
-- terminal and cannot be replayed; an expired/revoked authorization cannot cross
-- the executor side-effect boundary.

alter table public.ce_agent_execution_authorizations
  add column if not exists expires_at timestamptz not null default (now() + interval '5 minutes'),
  add column if not exists revoked_at timestamptz null,
  add column if not exists revocation_reason text null;

create index if not exists ce_agent_exec_auth_active_idx
  on public.ce_agent_execution_authorizations(status,expires_at);

drop function if exists public.ce_enforce_agent_execution(uuid,text,uuid,text,text,text,text,text);
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
  auth public.ce_agent_execution_authorizations%rowtype;
begin
  select * into c from public.ce_agent_compositions
    where id=p_composition_id and tenant_id=p_tenant_id for update;
  if not found then return query select false,'COMPOSITION_NOT_FOUND',null,null,null,null; return; end if;

  select * into a from public.ce_agent_approvals
    where composition_id=c.id for update;
  if not found then return query select false,'APPROVAL_OBJECT_NOT_FOUND',c.status,null,null,null; return; end if;

  select * into m from public.ce_missions
    where id=p_mission_id for update;
  if not found then return query select false,'MISSION_NOT_FOUND',c.status,a.status,null,null; return; end if;

  if c.mission_id is distinct from p_mission_id then
    return query select false,'MISSION_BINDING_MISMATCH',c.status,a.status,m.state,null; return;
  end if;
  if c.capability_id <> p_capability_id then
    return query select false,'CAPABILITY_SCOPE_MISMATCH',c.status,a.status,m.state,null; return;
  end if;
  if c.correlation_id <> p_correlation_id or a.correlation_id <> p_correlation_id then
    return query select false,'CORRELATION_MISMATCH',c.status,a.status,m.state,null; return;
  end if;
  if p_skill_id is null or p_skill_version is null or p_mode is null then
    return query select false,'EXECUTOR_SCOPE_REQUIRED',c.status,a.status,m.state,null; return;
  end if;
  if c.skill_id is distinct from p_skill_id then
    return query select false,'SKILL_SCOPE_MISMATCH',c.status,a.status,m.state,null; return;
  end if;
  if c.skill_version is distinct from p_skill_version then
    return query select false,'SKILL_VERSION_SCOPE_MISMATCH',c.status,a.status,m.state,null; return;
  end if;
  if c.mode is distinct from p_mode then
    return query select false,'MODE_SCOPE_MISMATCH',c.status,a.status,m.state,null; return;
  end if;
  if a.status <> 'APPROVED' or c.status <> 'APPROVED' then
    return query select false,'APPROVAL_REQUIRED',c.status,a.status,m.state,null; return;
  end if;
  if m.state <> 'APPROVED' then
    return query select false,'MISSION_STATE_NOT_APPROVED',c.status,a.status,m.state,null; return;
  end if;

  select * into auth
    from public.ce_agent_execution_authorizations
    where correlation_id=p_correlation_id
    for update;

  if found then
    if auth.status = 'AUTHORIZED' and auth.expires_at <= now() then
      update public.ce_agent_execution_authorizations
        set status='EXPIRED',
            metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('expired_at',now(),'source','M12.5')
        where id=auth.id;
      return query select false,'AUTHORIZATION_EXPIRED',c.status,a.status,m.state,null;
      return;
    end if;

    if auth.status = 'AUTHORIZED' then
      if auth.composition_id=c.id
        and auth.tenant_id=c.tenant_id
        and auth.mission_id=m.id
        and auth.capability_id=c.capability_id
        and auth.skill_id=c.skill_id
        and auth.skill_version=c.skill_version
        and auth.mode=c.mode then
        return query select true,'EXECUTION_ALREADY_AUTHORIZED',c.status,a.status,m.state,auth.id;
        return;
      end if;
      return query select false,'AUTHORIZATION_SCOPE_MISMATCH',c.status,a.status,m.state,null;
      return;
    end if;

    if auth.status = 'REVOKED' then
      return query select false,'AUTHORIZATION_REVOKED',c.status,a.status,m.state,null;
      return;
    end if;

    if auth.status = 'EXPIRED' then
      return query select false,'AUTHORIZATION_EXPIRED',c.status,a.status,m.state,null;
      return;
    end if;

    return query select false,'AUTHORIZATION_ALREADY_CONSUMED',c.status,a.status,m.state,null;
    return;
  end if;

  insert into public.ce_agent_execution_authorizations(
    composition_id,tenant_id,mission_id,capability_id,correlation_id,
    skill_id,skill_version,mode,expires_at
  )
  values(
    c.id,c.tenant_id,m.id,c.capability_id,c.correlation_id,
    c.skill_id,c.skill_version,c.mode,now()+interval '5 minutes'
  )
  returning * into auth;

  return query select true,'EXECUTION_AUTHORIZED',c.status,a.status,m.state,auth.id;
end;
$$;

revoke all on function public.ce_enforce_agent_execution(uuid,text,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ce_enforce_agent_execution(uuid,text,uuid,text,text,text,text,text) to service_role;

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

  if a.status <> 'AUTHORIZED' then
    raise exception 'EXECUTION_AUTHORIZATION_NOT_ACTIVE';
  end if;

  if a.expires_at <= now() then
    update public.ce_agent_execution_authorizations
      set status='EXPIRED',
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('expired_at',now(),'source','M12.5')
      where id=a.id;
    raise exception 'EXECUTION_AUTHORIZATION_EXPIRED';
  end if;

  select * into c from public.ce_agent_compositions where id=p_composition_id for update;
  select * into m from public.ce_missions where id=c.mission_id for update;

  if m.state not in ('EXECUTING','MEASURING') then
    raise exception 'MISSION_STATE_NOT_CLOSABLE';
  end if;

  update public.ce_agent_execution_authorizations
    set status='CONSUMED',
        consumed_at=now(),
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'success',p_success,'reason',p_reason,'closed_at',now(),'source','M12.5'
        )
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

create or replace function public.ce_revoke_agent_execution(
  p_composition_id uuid,
  p_authorization_id uuid,
  p_reason text
) returns table(revoked boolean,reason text,status text)
language plpgsql security definer set search_path=''
as $$
declare
  a public.ce_agent_execution_authorizations%rowtype;
begin
  if p_reason is null or length(trim(p_reason))=0 then
    return query select false,'REVOCATION_REASON_REQUIRED',null;
    return;
  end if;

  select * into a
    from public.ce_agent_execution_authorizations
    where id=p_authorization_id and composition_id=p_composition_id
    for update;

  if not found then
    return query select false,'AUTHORIZATION_NOT_FOUND',null;
    return;
  end if;

  if a.status <> 'AUTHORIZED' then
    return query select false,'AUTHORIZATION_NOT_ACTIVE',a.status;
    return;
  end if;

  update public.ce_agent_execution_authorizations
    set status='REVOKED',
        revoked_at=now(),
        revocation_reason=trim(p_reason),
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('source','M12.5')
    where id=a.id;

  return query select true,'AUTHORIZATION_REVOKED','REVOKED';
end;
$$;

revoke all on function public.ce_revoke_agent_execution(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ce_revoke_agent_execution(uuid,uuid,text) to service_role;
