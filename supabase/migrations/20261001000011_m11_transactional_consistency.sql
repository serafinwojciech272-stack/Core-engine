create or replace function public.ce_record_measurement_and_complete_mission(
  p_mission_id uuid,
  p_correlation_id text,
  p_predicted numeric,
  p_actual numeric,
  p_evidence_ids jsonb default '[]'::jsonb
)
returns table(completed boolean,result_mode text,mission_id uuid,from_state text,to_state text,event_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  m public.ce_missions%rowtype;
  e public.ce_events%rowtype;
begin
  if p_correlation_id is null or length(trim(p_correlation_id))=0 then
    raise exception 'CORRELATION_ID_REQUIRED';
  end if;
  if p_predicted is null or p_actual is null then
    raise exception 'MEASUREMENT_VALUES_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_evidence_ids,'[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_evidence_ids,'[]'::jsonb))=0 then
    raise exception 'EVIDENCE_REQUIRED';
  end if;

  select * into m from public.ce_missions where id=p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;

  if m.state<>'MEASURING' then
    if exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='MEASUREMENT_RECORDED'
        and metadata->>'correlationId'=p_correlation_id
    ) then
      select * into e
      from public.ce_events
      where mission_id=p_mission_id
        and event_type='MEASUREMENT_RECORDED'
        and metadata->>'correlationId'=p_correlation_id
      order by created_at desc limit 1;
      return query select false,'IDEMPOTENCY_REPLAY'::text,m.id,m.state,m.state,e.id;
      return;
    end if;
    return query select false,'MISSION_STATE_BLOCKED'::text,m.id,m.state,m.state,null::uuid;
    return;
  end if;

  insert into public.ce_events(
    mission_id,decision_id,event_type,from_state,to_state,actor_type,correlation_id,metadata
  )
  values(
    m.id,m.decision_id,'MEASUREMENT_RECORDED','MEASURING','COMPLETED','system',p_correlation_id,
    jsonb_build_object(
      'source','M11_TRANSACTIONAL_CONSISTENCY_GATE',
      'correlationId',p_correlation_id,
      'predicted',p_predicted,
      'actual',p_actual,
      'evidenceIds',p_evidence_ids
    )
  )
  returning * into e;

  update public.ce_missions
  set state='COMPLETED',updated_at=now()
  where id=p_mission_id;

  insert into public.ce_events(
    mission_id,decision_id,event_type,from_state,to_state,actor_type,correlation_id,metadata
  )
  values(
    m.id,m.decision_id,'STATE_CHANGED','MEASURING','COMPLETED','system',p_correlation_id,
    jsonb_build_object(
      'source','M11_TRANSACTIONAL_CONSISTENCY_GATE',
      'correlationId',p_correlation_id,
      'measurementEventId',e.id
    )
  );

  return query select true,'COMPLETED'::text,m.id,'MEASURING'::text,'COMPLETED'::text,e.id;
end $$;

revoke all on function public.ce_record_measurement_and_complete_mission(uuid,text,numeric,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.ce_record_measurement_and_complete_mission(uuid,text,numeric,numeric,jsonb) to service_role;


create or replace function public.ce_verify_audit_trail(p_mission_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r record;
  m public.ce_missions%rowtype;
  expected_seq bigint:=0;
  expected_prev text:=null;
  expected_hash text;
  canonical text;
  violations jsonb:='[]'::jsonb;
  checked integer:=0;
  current_state text:=null;
  allowed boolean;
  expected_actor text;
  has_reason boolean;
  has_source boolean;
  evidence jsonb;
  state_event record;
  state_count integer;
  required_event_type text;
begin
  select * into m from public.ce_missions where id=p_mission_id;
  if not found then
    return jsonb_build_object(
      'missionId',p_mission_id,
      'ok',false,
      'eventsChecked',0,
      'finalState',null,
      'violations',jsonb_build_array(jsonb_build_object('code','MISSION_NOT_FOUND'))
    );
  end if;

  for r in
    select * from public.ce_events
    where mission_id=p_mission_id
    order by audit_seq asc nulls last,created_at asc,id asc
  loop
    checked:=checked+1;
    expected_seq:=expected_seq+1;

    if r.audit_seq is distinct from expected_seq then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','AUDIT_SEQUENCE_GAP','eventId',r.id,'expected',expected_seq,'actual',r.audit_seq
      ));
    end if;

    if r.prev_event_hash is distinct from expected_prev then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','AUDIT_PREV_HASH_MISMATCH','eventId',r.id
      ));
    end if;

    canonical:=coalesce(r.mission_id::text,'')||'|'||
      coalesce(r.decision_id::text,'')||'|'||
      coalesce(r.event_type,'')||'|'||
      coalesce(r.from_state,'')||'|'||
      coalesce(r.to_state,'')||'|'||
      coalesce(r.actor_type,'')||'|'||
      coalesce(r.actor_id,'')||'|'||
      coalesce(r.correlation_id,'')||'|'||
      coalesce(r.audit_seq::text,'')||'|'||
      coalesce(r.prev_event_hash,'')||'|'||
      coalesce(r.metadata::text,'{}')||'|'||
      coalesce(r.created_at::text,'');

    expected_hash:=encode(digest(canonical,'sha256'),'hex');

    if r.event_hash is distinct from expected_hash then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','AUDIT_HASH_MISMATCH','eventId',r.id
      ));
    end if;

    if nullif(trim(coalesce(r.correlation_id,'')),'') is null then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','CORRELATION_ID_MISSING','eventId',r.id
      ));
    end if;

    expected_actor:=case
      when r.event_type='STATE_CHANGED' and r.to_state in ('APPROVED','REJECTED','EXPIRED') then 'human'
      when r.event_type in (
        'MISSION_CREATED','STATE_CHANGED','EXECUTION_RECORDED','MEASUREMENT_RECORDED',
        'CAPABILITY_EXECUTED','CAPABILITY_EXECUTION_FAILED','LEARNING_RECORDED'
      ) then 'system'
      else null
    end;

    has_reason:=nullif(trim(coalesce(r.metadata->>'reason','')),'') is not null;
    has_source:=nullif(trim(coalesce(r.metadata->>'source','')),'') is not null;

    if expected_actor is not null and r.actor_type<>expected_actor then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','ACTOR_TYPE_MISMATCH','eventId',r.id,'expected',expected_actor,'actual',r.actor_type
      ));
    end if;

    if r.event_type='STATE_CHANGED' and r.to_state='APPROVED'
       and nullif(trim(coalesce(r.actor_id,'')),'') is null then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','APPROVER_ID_MISSING','eventId',r.id
      ));
    end if;

    if r.event_type='STATE_CHANGED' and r.to_state='APPROVED' and not has_reason then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','APPROVAL_REASON_MISSING','eventId',r.id
      ));
    end if;

    if r.event_type='STATE_CHANGED' and not has_source then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','EVENT_SOURCE_MISSING','eventId',r.id
      ));
    end if;

    evidence:=r.metadata->'evidenceIds';
    if r.event_type in (
      'EXECUTION_RECORDED','MEASUREMENT_RECORDED',
      'CAPABILITY_EXECUTED','CAPABILITY_EXECUTION_FAILED','LEARNING_RECORDED'
    ) then
      if jsonb_typeof(evidence)<>'array' or jsonb_array_length(evidence)=0 then
        violations:=violations||jsonb_build_array(jsonb_build_object(
          'code','EVIDENCE_REQUIRED','eventId',r.id,'eventType',r.event_type
        ));
      elsif exists(
        select 1
        from jsonb_array_elements(evidence) v
        where jsonb_typeof(v)<>'string' or nullif(trim(v#>>'{}'),'') is null
      ) then
        violations:=violations||jsonb_build_array(jsonb_build_object(
          'code','EVIDENCE_ID_INVALID','eventId',r.id,'eventType',r.event_type
        ));
      end if;
    end if;

    if r.event_type='STATE_CHANGED' then
      if r.from_state is null or r.to_state is null then
        violations:=violations||jsonb_build_array(jsonb_build_object(
          'code','STATE_TRANSITION_INCOMPLETE','eventId',r.id
        ));
      elsif current_state is not null and r.from_state<>current_state then
        violations:=violations||jsonb_build_array(jsonb_build_object(
          'code','STATE_CHAIN_BREAK','eventId',r.id,
          'expectedFrom',current_state,'actualFrom',r.from_state
        ));
      end if;

      allowed:=case
        when r.from_state='DISCOVERED' and r.to_state in ('DIAGNOSED','EXPIRED') then true
        when r.from_state='DIAGNOSED' and r.to_state in ('PROPOSED','FAILED') then true
        when r.from_state='PROPOSED' and r.to_state in ('AWAITING_APPROVAL','EXPIRED') then true
        when r.from_state='AWAITING_APPROVAL' and r.to_state in ('APPROVED','REJECTED','EXPIRED') then true
        when r.from_state='APPROVED' and r.to_state in ('EXECUTING','REJECTED') then true
        when r.from_state='EXECUTING' and r.to_state in ('MEASURING','FAILED') then true
        when r.from_state='MEASURING' and r.to_state in ('COMPLETED','FAILED') then true
        when r.from_state='COMPLETED' and r.to_state='LEARNED' then true
        when r.from_state='FAILED' and r.to_state in ('APPROVED','REJECTED') then true
        else false
      end;

      if not allowed then
        violations:=violations||jsonb_build_array(jsonb_build_object(
          'code','INVALID_STATE_TRANSITION','eventId',r.id,'from',r.from_state,'to',r.to_state
        ));
      end if;

      current_state:=r.to_state;
    end if;

    expected_prev:=r.event_hash;
  end loop;

  if current_state is distinct from m.state then
    violations:=violations||jsonb_build_array(jsonb_build_object(
      'code','MISSION_STATE_AUDIT_STATE_MISMATCH',
      'missionState',m.state,
      'auditState',current_state
    ));
  end if;

  if m.state='EXECUTING' then
    select count(*) into state_count
    from public.ce_events
    where mission_id=p_mission_id
      and event_type='STATE_CHANGED'
      and from_state='APPROVED'
      and to_state='EXECUTING';
    if state_count=0 then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','EXECUTING_START_EVENT_MISSING'
      ));
    end if;

    select * into state_event
    from public.ce_events
    where mission_id=p_mission_id
      and event_type='STATE_CHANGED'
      and from_state='APPROVED'
      and to_state='EXECUTING'
    order by audit_seq desc limit 1;

    if state_event.id is not null
       and not exists(
         select 1 from public.ce_action_claims c
         where c.mission_id=p_mission_id
           and c.idempotency_key=state_event.metadata->>'idempotency_key'
       ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','EXECUTION_CLAIM_MISSING'
      ));
    end if;
  end if;

  if m.state='MEASURING' then
    if not exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='EXECUTION_RECORDED'
    ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','EXECUTION_RECORDED_MISSING'
      ));
    end if;
    if not exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='STATE_CHANGED'
        and from_state='EXECUTING'
        and to_state='MEASURING'
    ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','EXECUTION_TO_MEASURING_STATE_EVENT_MISSING'
      ));
    end if;
  end if;

  if m.state='COMPLETED' then
    if not exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='MEASUREMENT_RECORDED'
    ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','MEASUREMENT_RECORDED_MISSING'
      ));
    end if;
    if not exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='STATE_CHANGED'
        and from_state='MEASURING'
        and to_state='COMPLETED'
    ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','MEASURING_TO_COMPLETED_STATE_EVENT_MISSING'
      ));
    end if;
  end if;

  if m.state='LEARNED' then
    if not exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='LEARNING_RECORDED'
    ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','LEARNING_RECORDED_MISSING'
      ));
    end if;
    if not exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='STATE_CHANGED'
        and from_state='COMPLETED'
        and to_state='LEARNED'
    ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','COMPLETED_TO_LEARNED_STATE_EVENT_MISSING'
      ));
    end if;
  end if;

  if m.state='FAILED' then
    if not exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='CAPABILITY_EXECUTION_FAILED'
    ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','CAPABILITY_FAILURE_EVENT_MISSING'
      ));
    end if;
    if not exists(
      select 1 from public.ce_events
      where mission_id=p_mission_id
        and event_type='STATE_CHANGED'
        and to_state='FAILED'
    ) then
      violations:=violations||jsonb_build_array(jsonb_build_object(
        'code','FAILED_STATE_EVENT_MISSING'
      ));
    end if;
  end if;

  return jsonb_build_object(
    'missionId',p_mission_id,
    'ok',jsonb_array_length(violations)=0,
    'eventsChecked',checked,
    'finalState',current_state,
    'missionState',m.state,
    'violations',violations
  );
end $$;

revoke all on function public.ce_verify_audit_trail(uuid) from public,anon,authenticated;
grant execute on function public.ce_verify_audit_trail(uuid) to service_role;
