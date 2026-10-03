create or replace function public.ce_record_measurement_and_complete_mission(
  p_mission_id uuid,
  p_correlation_id text,
  p_predicted numeric,
  p_actual numeric,
  p_evidence_ids jsonb default '[]'::jsonb
) returns table(
  completed boolean,
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

  if p_predicted is null or p_actual is null then
    raise exception 'MEASUREMENT_VALUES_REQUIRED';
  end if;

  select * into m
  from public.ce_missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'MISSION_NOT_FOUND';
  end if;

  if m.state <> 'MEASURING' then
    return query select
      false,
      'MISSION_STATE_BLOCKED'::text,
      m.id,
      m.state,
      m.state,
      null::uuid;
    return;
  end if;

  if exists(
    select 1
    from public.ce_events
    where mission_id = p_mission_id
      and event_type = 'MEASUREMENT_RECORDED'
      and metadata->>'correlationId' = p_correlation_id
  ) then
    select * into e
    from public.ce_events
    where mission_id = p_mission_id
      and event_type = 'MEASUREMENT_RECORDED'
      and metadata->>'correlationId' = p_correlation_id
    order by created_at desc
    limit 1;

    return query select
      false,
      'IDEMPOTENCY_REPLAY'::text,
      m.id,
      m.state,
      m.state,
      e.id;
    return;
  end if;

  insert into public.ce_events(
    mission_id,
    decision_id,
    event_type,
    from_state,
    to_state,
    actor_type,
    metadata
  )
  values(
    m.id,
    m.decision_id,
    'MEASUREMENT_RECORDED',
    m.state,
    'COMPLETED',
    'system',
    jsonb_build_object(
      'source', 'ATOMIC_MEASUREMENT_COMPLETION_GATE',
      'correlationId', p_correlation_id,
      'predicted', p_predicted,
      'actual', p_actual,
      'evidenceIds', coalesce(p_evidence_ids, '[]'::jsonb)
    )
  )
  returning * into e;

  update public.ce_missions
  set state = 'COMPLETED',
      updated_at = now()
  where id = p_mission_id;

  return query select
    true,
    'COMPLETED'::text,
    m.id,
    m.state,
    'COMPLETED'::text,
    e.id;
end;
$$;

revoke all on function public.ce_record_measurement_and_complete_mission(uuid,text,numeric,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.ce_record_measurement_and_complete_mission(uuid,text,numeric,numeric,jsonb) to service_role;
