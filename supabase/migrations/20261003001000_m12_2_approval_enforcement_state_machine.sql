create or replace function public.ce_enforce_agent_execution(
  p_composition_id uuid,
  p_tenant_id text,
  p_mission_id uuid,
  p_capability_id text,
  p_correlation_id text
) returns table(
  allowed boolean,
  reason text,
  composition_status text,
  approval_status text,
  mission_state text,
  authorization_id uuid
)
language plpgsql
security definer
set search_path=''
as $$
declare
  c public.ce_agent_compositions%rowtype;
  a public.ce_agent_approvals%rowtype;
  m public.ce_missions%rowtype;
  auth_id uuid := gen_random_uuid();
begin
  if p_composition_id is null or nullif(trim(coalesce(p_tenant_id,'')),'') is null
     or p_mission_id is null or nullif(trim(coalesce(p_capability_id,'')),'') is null
     or nullif(trim(coalesce(p_correlation_id,'')),'') is null then
    return query select false,'EXECUTION_CONTEXT_REQUIRED',null,null,null,null;
    return;
  end if;

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

  select * into m from public.ce_missions where id=p_mission_id for update;
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
  if c.correlation_id <> p_correlation_id then
    return query select false,'CORRELATION_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;
  if a.correlation_id <> p_correlation_id then
    return query select false,'APPROVAL_CORRELATION_MISMATCH',c.status,a.status,m.state,null;
    return;
  end if;
  if a.status <> 'APPROVED' or c.status <> 'APPROVED' then
    return query select false,'APPROVAL_REQUIRED',c.status,a.status,m.state,null;
    return;
  end if;
  if m.state not in ('APPROVED','EXECUTING') then
    return query select false,'MISSION_STATE_NOT_EXECUTABLE',c.status,a.status,m.state,null;
    return;
  end if;

  if m.state='APPROVED' then
    update public.ce_missions set state='EXECUTING',updated_at=now() where id=m.id;
  end if;

  update public.ce_agent_compositions set updated_at=now() where id=c.id;

  return query select true,'EXECUTION_AUTHORIZED',c.status,a.status,'EXECUTING',auth_id;
end;
$$;

revoke all on function public.ce_enforce_agent_execution(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ce_enforce_agent_execution(uuid,text,uuid,text,text) to service_role;

create or replace function public.ce_close_agent_execution(
  p_composition_id uuid,
  p_authorization_id uuid,
  p_success boolean,
  p_reason text default null
) returns table(composition_status text, mission_state text, result text)
language plpgsql
security definer
set search_path=''
as $$
declare c public.ce_agent_compositions%rowtype; m public.ce_missions%rowtype;
begin
  select * into c from public.ce_agent_compositions where id=p_composition_id for update;
  if not found then raise exception 'COMPOSITION_NOT_FOUND'; end if;
  select * into m from public.ce_missions where id=c.mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if m.state not in ('EXECUTING','MEASURING') then raise exception 'MISSION_STATE_NOT_CLOSABLE'; end if;
  if p_success then
    update public.ce_agent_compositions set status='EXECUTED',updated_at=now() where id=c.id;
    return query select 'EXECUTED','EXECUTING','EXECUTION_RECORDED';
  else
    update public.ce_agent_compositions set status='CLOSED',updated_at=now() where id=c.id;
    return query select 'CLOSED',m.state,'EXECUTION_FAILED';
  end if;
end;
$$;

revoke all on function public.ce_close_agent_execution(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.ce_close_agent_execution(uuid,uuid,boolean,text) to service_role;
