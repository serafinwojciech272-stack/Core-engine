alter table public.ce_events
  add column if not exists correlation_id text,
  add column if not exists actor_id text,
  add column if not exists audit_seq bigint,
  add column if not exists prev_event_hash text,
  add column if not exists event_hash text;

create index if not exists ce_events_mission_seq_idx
  on public.ce_events(mission_id, audit_seq);

create or replace function public.ce_prepare_audit_event()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  prev_hash text;
  next_seq bigint;
  correlation text;
  canonical text;
begin
  if new.mission_id is null then
    correlation := coalesce(new.metadata->>'correlationId','system:event:'||new.id::text);
  else
    perform pg_advisory_xact_lock(hashtext(new.mission_id::text));
    select coalesce(max(audit_seq),0)+1, max(event_hash)
      into next_seq, prev_hash
      from public.ce_events
      where mission_id=new.mission_id;
    new.audit_seq := next_seq;
    new.prev_event_hash := prev_hash;
    correlation := coalesce(
      nullif(new.correlation_id,''),
      nullif(new.metadata->>'correlationId',''),
      'mission:'||new.mission_id::text
    );
  end if;

  new.correlation_id := correlation;
  new.actor_id := coalesce(nullif(new.actor_id,''), new.metadata->>'actorId', new.actor_type);

  canonical := coalesce(new.mission_id::text,'')||'|'||
    coalesce(new.decision_id::text,'')||'|'||
    coalesce(new.event_type,'')||'|'||
    coalesce(new.from_state,'')||'|'||
    coalesce(new.to_state,'')||'|'||
    coalesce(new.actor_type,'')||'|'||
    coalesce(new.actor_id,'')||'|'||
    coalesce(new.correlation_id,'')||'|'||
    coalesce(new.audit_seq::text,'')||'|'||
    coalesce(new.prev_event_hash,'')||'|'||
    coalesce(new.metadata::text,'{}')||'|'||
    coalesce(new.created_at::text,'');

  new.event_hash := encode(digest(canonical,'sha256'),'hex');
  return new;
end;
$$;

drop trigger if exists ce_events_audit_integrity on public.ce_events;
create trigger ce_events_audit_integrity
before insert on public.ce_events
for each row execute function public.ce_prepare_audit_event();


do $
declare
  mission record;
  ev record;
  seq bigint;
  prev text;
  canonical text;
  h text;
begin
  for mission in select distinct mission_id from public.ce_events where mission_id is not null loop
    seq := 0;
    prev := null;
    for ev in
      select *
      from public.ce_events
      where mission_id=mission.mission_id
      order by created_at asc, id asc
    loop
      seq := seq + 1;
      canonical := coalesce(ev.mission_id::text,'')||'|'||
        coalesce(ev.decision_id::text,'')||'|'||
        coalesce(ev.event_type,'')||'|'||
        coalesce(ev.from_state,'')||'|'||
        coalesce(ev.to_state,'')||'|'||
        coalesce(ev.actor_type,'')||'|'||
        coalesce(ev.actor_id,nullif(ev.metadata->>'actorId',''),ev.actor_type)||'|'||
        coalesce(ev.correlation_id,nullif(ev.metadata->>'correlationId',''),'mission:'||ev.mission_id::text)||'|'||
        seq::text||'|'||
        coalesce(prev,'')||'|'||
        coalesce(ev.metadata::text,'{}')||'|'||
        coalesce(ev.created_at::text,'');
      h := encode(digest(canonical,'sha256'),'hex');
      update public.ce_events
      set audit_seq=seq,
          prev_event_hash=prev,
          correlation_id=coalesce(correlation_id,nullif(metadata->>'correlationId',''),'mission:'||mission.mission_id::text),
          actor_id=coalesce(actor_id,nullif(metadata->>'actorId',''),actor_type),
          event_hash=h
      where id=ev.id;
      prev := h;
    end loop;
  end loop;
end $;

create or replace function public.ce_verify_audit_trail(p_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r record;
  expected_seq bigint := 0;
  expected_prev text := null;
  expected_hash text;
  canonical text;
  violations jsonb := '[]'::jsonb;
  checked integer := 0;
begin
  for r in
    select *
    from public.ce_events
    where mission_id=p_mission_id
    order by audit_seq asc nulls last, created_at asc, id asc
  loop
    checked := checked + 1;
    expected_seq := expected_seq + 1;

    if r.audit_seq is distinct from expected_seq then
      violations := violations || jsonb_build_array(jsonb_build_object(
        'code','AUDIT_SEQUENCE_GAP','eventId',r.id,'expected',expected_seq,'actual',r.audit_seq
      ));
    end if;

    if r.prev_event_hash is distinct from expected_prev then
      violations := violations || jsonb_build_array(jsonb_build_object(
        'code','AUDIT_PREV_HASH_MISMATCH','eventId',r.id
      ));
    end if;

    canonical := coalesce(r.mission_id::text,'')||'|'||
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

    expected_hash := encode(digest(canonical,'sha256'),'hex');

    if r.event_hash is distinct from expected_hash then
      violations := violations || jsonb_build_array(jsonb_build_object(
        'code','AUDIT_HASH_MISMATCH','eventId',r.id
      ));
    end if;

    if r.correlation_id is null or length(trim(r.correlation_id))=0 then
      violations := violations || jsonb_build_array(jsonb_build_object(
        'code','CORRELATION_ID_MISSING','eventId',r.id
      ));
    end if;

    if r.event_type='STATE_CHANGED' and r.from_state is null then
      violations := violations || jsonb_build_array(jsonb_build_object(
        'code','STATE_FROM_MISSING','eventId',r.id
      ));
    end if;

    expected_prev := r.event_hash;
  end loop;

  return jsonb_build_object(
    'missionId',p_mission_id,
    'ok',jsonb_array_length(violations)=0,
    'eventsChecked',checked,
    'violations',violations
  );
end;
$$;

revoke all on function public.ce_verify_audit_trail(uuid) from public,anon,authenticated;
grant execute on function public.ce_verify_audit_trail(uuid) to service_role;

create or replace function public.ce_record_execution_and_enter_measurement(
  p_mission_id uuid,p_correlation_id text,p_action_id text,p_execution_id text,p_evidence_ids jsonb
) returns table(advanced boolean,result_mode text,mission_id uuid,from_state text,to_state text,event_id uuid)
language plpgsql security definer set search_path='' as $$
declare m public.ce_missions%rowtype; e public.ce_events%rowtype;
begin
  if p_correlation_id is null or length(trim(p_correlation_id))=0 then raise exception 'CORRELATION_ID_REQUIRED'; end if;
  select * into m from public.ce_missions where id=p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if m.state<>'EXECUTING' then
    return query select false,'MISSION_STATE_BLOCKED'::text,m.id,m.state,m.state,null::uuid; return;
  end if;
  insert into public.ce_events(mission_id,decision_id,event_type,from_state,to_state,actor_type,correlation_id,metadata)
  values(m.id,m.decision_id,'EXECUTION_RECORDED','EXECUTING','MEASURING','system',p_correlation_id,
    jsonb_build_object('source','M11_AUDIT_INTEGRITY','actionId',p_action_id,'executionId',p_execution_id,'evidenceIds',coalesce(p_evidence_ids,'[]'::jsonb)))
  returning * into e;
  update public.ce_missions set state='MEASURING',updated_at=now() where id=m.id;
  insert into public.ce_events(mission_id,decision_id,event_type,from_state,to_state,actor_type,correlation_id,metadata)
  values(m.id,m.decision_id,'STATE_CHANGED','EXECUTING','MEASURING','system',p_correlation_id,
    jsonb_build_object('source','M11_AUDIT_INTEGRITY','executionId',p_execution_id));
  return query select true,'EXECUTED'::text,m.id,'EXECUTING'::text,'MEASURING'::text,e.id;
end;
$$;

revoke all on function public.ce_record_execution_and_enter_measurement(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ce_record_execution_and_enter_measurement(uuid,text,text,text,jsonb) to service_role;
