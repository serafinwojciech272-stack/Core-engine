-- M12.4: persistent executor lifecycle + authorization consumption verification
-- The authorization is single-use. Closure consumes it; this verifier proves that
-- the consumed authorization still matches the exact execution scope.

create or replace function public.ce_verify_agent_execution_consumption(
  p_composition_id uuid,
  p_authorization_id uuid,
  p_tenant_id text,
  p_mission_id uuid,
  p_capability_id text,
  p_correlation_id text,
  p_skill_id text,
  p_skill_version text,
  p_mode text,
  p_expected_result text
) returns table(
  verified boolean,
  reason text,
  authorization_status text,
  composition_status text,
  mission_state text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.ce_agent_execution_authorizations%rowtype;
  c public.ce_agent_compositions%rowtype;
  m public.ce_missions%rowtype;
begin
  select * into a
  from public.ce_agent_execution_authorizations
  where id=p_authorization_id and composition_id=p_composition_id
  for update;

  if not found then
    return query select false,'AUTHORIZATION_NOT_FOUND',null,null,null;
    return;
  end if;

  select * into c
  from public.ce_agent_compositions
  where id=p_composition_id
  for update;

  if not found then
    return query select false,'COMPOSITION_NOT_FOUND',a.status,null,null;
    return;
  end if;

  select * into m
  from public.ce_missions
  where id=p_mission_id
  for update;

  if not found then
    return query select false,'MISSION_NOT_FOUND',a.status,c.status,null;
    return;
  end if;

  if a.tenant_id <> p_tenant_id
     or c.tenant_id <> p_tenant_id
     or m.id <> p_mission_id then
    return query select false,'TENANT_OR_MISSION_SCOPE_MISMATCH',a.status,c.status,m.state;
    return;
  end if;

  if a.capability_id <> p_capability_id
     or c.capability_id <> p_capability_id then
    return query select false,'CAPABILITY_SCOPE_MISMATCH',a.status,c.status,m.state;
    return;
  end if;

  if a.correlation_id <> p_correlation_id
     or c.correlation_id <> p_correlation_id then
    return query select false,'CORRELATION_SCOPE_MISMATCH',a.status,c.status,m.state;
    return;
  end if;

  if a.skill_id <> p_skill_id
     or a.skill_version <> p_skill_version
     or a.mode <> p_mode
     or c.skill_id <> p_skill_id
     or c.skill_version <> p_skill_version
     or c.mode <> p_mode then
    return query select false,'SKILL_SCOPE_MISMATCH',a.status,c.status,m.state;
    return;
  end if;

  if a.status <> 'CONSUMED' then
    return query select false,'AUTHORIZATION_NOT_CONSUMED',a.status,c.status,m.state;
    return;
  end if;

  if p_expected_result = 'SUCCESS'
     and (c.status <> 'EXECUTED' or m.state <> 'MEASURING') then
    return query select false,'SUCCESS_LIFECYCLE_STATE_MISMATCH',a.status,c.status,m.state;
    return;
  end if;

  if p_expected_result = 'FAILURE'
     and c.status <> 'CLOSED' then
    return query select false,'FAILURE_LIFECYCLE_STATE_MISMATCH',a.status,c.status,m.state;
    return;
  end if;

  return query select true,'AUTHORIZATION_CONSUMPTION_VERIFIED',a.status,c.status,m.state;
end;
$$;

revoke all on function public.ce_verify_agent_execution_consumption(
  uuid,uuid,text,uuid,text,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.ce_verify_agent_execution_consumption(
  uuid,uuid,text,uuid,text,text,text,text,text,text
) to service_role;
