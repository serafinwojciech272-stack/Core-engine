create or replace function public.ce_record_execution_and_enter_measurement(
  p_mission_id uuid,
  p_correlation_id text,
  p_action_id text,
  p_execution_id text,
  p_evidence_ids jsonb default '[]'::jsonb
) returns table(
  advanced boolean,
  result_mode text,
  mission_id uuid,
  from_state text,
  to_state text,
  event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.ce_missions%rowtype;
  e public.ce_events%rowtype;
begin
  if p_correlation_id is null or length(trim(p_correlation_id)) = 0 then
    raise exception 'CORRELATION_ID_REQUIRED';
  end if;

  select * into m
  from public.ce_missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'MISSION_NOT_FOUND';
  end if;

  if m.state <> 'EXECUTING' then
    if exists(
      select 1 from public.ce_events
      where mission_id = p_mission_id
        and event_type = 'EXECUTION_RECORDED'
        and metadata->>'correlationId' = p_correlation_id
    ) then
      select * into e
      from public.ce_events
      where mission_id = p_mission_id
        and event_type = 'EXECUTION_RECORDED'
        and metadata->>'correlationId' = p_correlation_id
      order by created_at desc limit 1;

      return query select false,'IDEMPOTENCY_REPLAY'::text,m.id,m.state,m.state,e.id;
      return;
    end if;

    return query select false,'MISSION_STATE_BLOCKED'::text,m.id,m.state,m.state,null::uuid;
    return;
  end if;

  insert into public.ce_events(
    mission_id, decision_id, event_type, from_state, to_state, actor_type, metadata
  )
  values(
    m.id, m.decision_id, 'EXECUTION_RECORDED', m.state, 'MEASURING', 'system',
    jsonb_build_object(
      'source','ATOMIC_EXECUTION_MEASUREMENT_GATE',
      'correlationId',p_correlation_id,
      'actionId',p_action_id,
      'executionId',p_execution_id,
      'evidenceIds',coalesce(p_evidence_ids,'[]'::jsonb)
    )
  )
  returning * into e;

  update public.ce_missions
  set state='MEASURING', updated_at=now()
  where id=p_mission_id;

  insert into public.ce_events(
    mission_id, decision_id, event_type, from_state, to_state, actor_type, metadata
  )
  values(
    m.id, m.decision_id, 'STATE_CHANGED', 'EXECUTING', 'MEASURING', 'system',
    jsonb_build_object('source','ATOMIC_EXECUTION_MEASUREMENT_GATE','correlationId',p_correlation_id)
  );

  return query select true,'ADVANCED'::text,m.id,m.state,'MEASURING'::text,e.id;
end;
$$;

revoke all on function public.ce_record_execution_and_enter_measurement(uuid,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.ce_record_execution_and_enter_measurement(uuid,text,text,text,jsonb) to service_role;
