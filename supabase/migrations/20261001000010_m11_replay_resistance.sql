create or replace function public.ce_record_execution_and_enter_measurement(
  p_mission_id uuid,
  p_correlation_id text,
  p_action_id text,
  p_execution_id text,
  p_evidence_ids jsonb default '[]'::jsonb
) returns table(advanced boolean,result_mode text,mission_id uuid,from_state text,to_state text,event_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  m public.ce_missions%rowtype;
  e public.ce_events%rowtype;
  prior record;
begin
  if p_correlation_id is null or length(trim(p_correlation_id))=0 then raise exception 'CORRELATION_ID_REQUIRED'; end if;
  if p_action_id is null or length(trim(p_action_id))=0 then raise exception 'ACTION_ID_REQUIRED'; end if;
  if p_execution_id is null or length(trim(p_execution_id))=0 then raise exception 'EXECUTION_ID_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_evidence_ids,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_evidence_ids,'[]'::jsonb))=0 then raise exception 'EVIDENCE_REQUIRED'; end if;

  select * into m from public.ce_missions where id=p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;

  select mission_id,event_type,metadata->>'actionId' as action_id
    into prior
    from public.ce_events
    where metadata->>'correlationId'=p_correlation_id
       or correlation_id=p_correlation_id
    order by created_at desc limit 1;
  if found and prior.mission_id<>p_mission_id then raise exception 'CORRELATION_CONTEXT_REPLAY'; end if;
  if found and prior.action_id is not null and prior.action_id<>p_action_id then raise exception 'CORRELATION_ACTION_MISMATCH'; end if;

  if exists(
    select 1 from public.ce_events
    where event_type='EXECUTION_RECORDED'
      and metadata->>'executionId'=p_execution_id
      and mission_id<>p_mission_id
  ) then raise exception 'EXECUTION_CONTEXT_REPLAY'; end if;

  if exists(
    select 1 from public.ce_action_claims
    where idempotency_key = (
      select metadata->>'idempotency_key'
      from public.ce_events
      where mission_id=p_mission_id
        and event_type='STATE_CHANGED'
        and to_state='EXECUTING'
      order by created_at desc limit 1
    )
    and (mission_id<>p_mission_id or action<>('capability-execute:'||p_action_id))
  ) then raise exception 'IDEMPOTENCY_CONTEXT_REPLAY'; end if;

  if m.state<>'EXECUTING' then
    if exists(select 1 from public.ce_events where mission_id=p_mission_id and event_type='EXECUTION_RECORDED' and metadata->>'correlationId'=p_correlation_id) then
      select * into e from public.ce_events where mission_id=p_mission_id and event_type='EXECUTION_RECORDED' and metadata->>'correlationId'=p_correlation_id order by created_at desc limit 1;
      return query select false,'IDEMPOTENCY_REPLAY'::text,m.id,m.state,m.state,e.id; return;
    end if;
    return query select false,'MISSION_STATE_BLOCKED'::text,m.id,m.state,m.state,null::uuid; return;
  end if;

  insert into public.ce_events(mission_id,decision_id,event_type,from_state,to_state,actor_type,correlation_id,metadata)
  values(m.id,m.decision_id,'EXECUTION_RECORDED','EXECUTING','MEASURING','system',p_correlation_id,
    jsonb_build_object('source','M11_REPLAY_RESISTANCE_GATE','actionId',p_action_id,'executionId',p_execution_id,'evidenceIds',p_evidence_ids))
  returning * into e;

  update public.ce_missions set state='MEASURING',updated_at=now() where id=m.id;

  insert into public.ce_events(mission_id,decision_id,event_type,from_state,to_state,actor_type,correlation_id,metadata)
  values(m.id,m.decision_id,'STATE_CHANGED','EXECUTING','MEASURING','system',p_correlation_id,
    jsonb_build_object('source','M11_REPLAY_RESISTANCE_GATE','executionId',p_execution_id));

  return query select true,'ADVANCED'::text,m.id,'EXECUTING'::text,'MEASURING'::text,e.id;
end $$;

revoke all on function public.ce_record_execution_and_enter_measurement(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ce_record_execution_and_enter_measurement(uuid,text,text,text,jsonb) to service_role;

create or replace function public.ce_claim_and_start_mission(
 p_mission_id uuid,p_action text,p_idempotency_key text
) returns table(started boolean,claim_mode text,mission_id uuid,from_state text,to_state text,execution_count integer)
language plpgsql security definer set search_path='' as $$
declare m public.ce_missions%rowtype; rows_inserted integer; prior record;
begin
 if p_idempotency_key is null or length(trim(p_idempotency_key))=0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
 if p_action is null or length(trim(p_action))=0 then raise exception 'ACTION_REQUIRED'; end if;
 select * into m from public.ce_missions where id=p_mission_id for update;
 if not found then raise exception 'MISSION_NOT_FOUND'; end if;

 select mission_id,action into prior from public.ce_action_claims where idempotency_key=p_idempotency_key limit 1;
 if found and (prior.mission_id<>p_mission_id or prior.action<>p_action) then raise exception 'IDEMPOTENCY_CONTEXT_REPLAY'; end if;

 if m.state<>'APPROVED' then
  return query select false,'MISSION_STATE_BLOCKED'::text,m.id,m.state,m.state,m.execution_count; return;
 end if;

 insert into public.ce_action_claims(mission_id,action,idempotency_key)
 values(p_mission_id,p_action,p_idempotency_key)
 on conflict(mission_id,action,idempotency_key) do nothing;
 get diagnostics rows_inserted=row_count;
 if rows_inserted<>1 then
  return query select false,'IDEMPOTENCY_REPLAY'::text,m.id,m.state,m.state,m.execution_count; return;
 end if;

 update public.ce_missions set state='EXECUTING',execution_count=execution_count+1,updated_at=now()
 where id=p_mission_id returning id,m.state,state,execution_count into mission_id,from_state,to_state,execution_count;

 insert into public.ce_events(mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata)
 values(m.id,m.decision_id,'STATE_CHANGED',m.state,'EXECUTING','system',
   jsonb_build_object('source','M11_REPLAY_RESISTANCE_GATE','action',p_action,'idempotency_key',p_idempotency_key));

 return query select true,'STARTED'::text,mission_id,from_state,to_state,execution_count;
end $$;

revoke all on function public.ce_claim_and_start_mission(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ce_claim_and_start_mission(uuid,text,text) to service_role;
