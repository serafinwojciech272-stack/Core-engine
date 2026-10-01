create or replace function public.ce_fail_mission(
  p_mission_id uuid,
  p_failure_code text,
  p_retryable boolean,
  p_metadata jsonb default '{}'::jsonb
) returns table(
  failed boolean,
  result_mode text,
  mission_id uuid,
  from_state text,
  to_state text,
  retryable boolean,
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
  if p_failure_code is null or length(trim(p_failure_code)) = 0 then
    raise exception 'FAILURE_CODE_REQUIRED';
  end if;

  select * into m from public.ce_missions where id=p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;

  if m.state not in ('EXECUTING','MEASURING') then
    return query select false,'MISSION_STATE_BLOCKED'::text,m.id,m.state,m.state,p_retryable,null::uuid;
    return;
  end if;

  insert into public.ce_events(
    mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata
  )
  values(
    m.id,m.decision_id,'CAPABILITY_EXECUTION_FAILED',m.state,'FAILED','system',
    jsonb_build_object(
      'source','M11_FAILURE_SEMANTICS_GATE',
      'failureCode',p_failure_code,
      'retryable',p_retryable
    ) || coalesce(p_metadata,'{}'::jsonb)
  )
  returning * into e;

  update public.ce_missions set state='FAILED',updated_at=now() where id=p_mission_id;

  insert into public.ce_events(
    mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata
  )
  values(
    m.id,m.decision_id,'STATE_CHANGED',m.state,'FAILED','system',
    jsonb_build_object('source','M11_FAILURE_SEMANTICS_GATE','failureCode',p_failure_code,'retryable',p_retryable)
  );

  return query select true,'FAILED'::text,m.id,m.state,'FAILED'::text,p_retryable,e.id;
end;
$$;

create or replace function public.ce_approve_failed_retry(
  p_mission_id uuid,
  p_actor_type text,
  p_reason text
) returns table(
  approved boolean,
  result_mode text,
  mission_id uuid,
  from_state text,
  to_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.ce_missions%rowtype;
  last_failure public.ce_events%rowtype;
begin
  if p_actor_type <> 'human' then raise exception 'HUMAN_ACTOR_REQUIRED'; end if;
  if p_reason is null or length(trim(p_reason))=0 then raise exception 'RETRY_REASON_REQUIRED'; end if;

  select * into m from public.ce_missions where id=p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if m.state <> 'FAILED' then
    return query select false,'MISSION_STATE_BLOCKED'::text,m.id,m.state,m.state;
    return;
  end if;

  select * into last_failure
  from public.ce_events
  where mission_id=p_mission_id
    and event_type='CAPABILITY_EXECUTION_FAILED'
  order by created_at desc
  limit 1;

  if not found or coalesce((last_failure.metadata->>'retryable')::boolean,false) <> true then
    return query select false,'RETRY_NOT_ALLOWED'::text,m.id,m.state,m.state;
    return;
  end if;

  update public.ce_missions set state='APPROVED',updated_at=now() where id=p_mission_id;

  insert into public.ce_events(
    mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata
  )
  values(
    m.id,m.decision_id,'STATE_CHANGED','FAILED','APPROVED','human',
    jsonb_build_object('source','M11_GOVERNED_RETRY_APPROVAL','reason',p_reason)
  );

  return query select true,'APPROVED'::text,m.id,'FAILED'::text,'APPROVED'::text;
end;
$$;

revoke all on function public.ce_fail_mission(uuid,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.ce_fail_mission(uuid,text,boolean,jsonb) to service_role;
revoke all on function public.ce_approve_failed_retry(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ce_approve_failed_retry(uuid,text,text) to service_role;
