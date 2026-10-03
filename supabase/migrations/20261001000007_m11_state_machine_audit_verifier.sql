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
  current_state text := null;
  allowed boolean;
  last_correlation text := null;
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
      violations := violations || jsonb_build_array(jsonb_build_object('code','AUDIT_SEQUENCE_GAP','eventId',r.id,'expected',expected_seq,'actual',r.audit_seq));
    end if;

    if r.prev_event_hash is distinct from expected_prev then
      violations := violations || jsonb_build_array(jsonb_build_object('code','AUDIT_PREV_HASH_MISMATCH','eventId',r.id));
    end if;

    canonical := coalesce(r.mission_id::text,'')||'|'||coalesce(r.decision_id::text,'')||'|'||
      coalesce(r.event_type,'')||'|'||coalesce(r.from_state,'')||'|'||coalesce(r.to_state,'')||'|'||
      coalesce(r.actor_type,'')||'|'||coalesce(r.actor_id,'')||'|'||coalesce(r.correlation_id,'')||'|'||
      coalesce(r.audit_seq::text,'')||'|'||coalesce(r.prev_event_hash,'')||'|'||
      coalesce(r.metadata::text,'{}')||'|'||coalesce(r.created_at::text,'');

    expected_hash := encode(digest(canonical,'sha256'),'hex');
    if r.event_hash is distinct from expected_hash then
      violations := violations || jsonb_build_array(jsonb_build_object('code','AUDIT_HASH_MISMATCH','eventId',r.id));
    end if;

    if r.correlation_id is null or length(trim(r.correlation_id))=0 then
      violations := violations || jsonb_build_array(jsonb_build_object('code','CORRELATION_ID_MISSING','eventId',r.id));
    end if;

    if r.event_type='STATE_CHANGED' then
      if r.from_state is null or r.to_state is null then
        violations := violations || jsonb_build_array(jsonb_build_object('code','STATE_TRANSITION_INCOMPLETE','eventId',r.id));
      elsif current_state is not null and r.from_state<>current_state then
        violations := violations || jsonb_build_array(jsonb_build_object('code','STATE_CHAIN_BREAK','eventId',r.id,'expectedFrom',current_state,'actualFrom',r.from_state));
      end if;
      allowed := case
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
        violations := violations || jsonb_build_array(jsonb_build_object('code','INVALID_STATE_TRANSITION','eventId',r.id,'from',r.from_state,'to',r.to_state));
      end if;
      current_state := r.to_state;
    end if;

    if r.event_type in ('EXECUTION_RECORDED','MEASUREMENT_RECORDED','CAPABILITY_EXECUTED','CAPABILITY_EXECUTION_FAILED','LEARNING_RECORDED') and last_correlation is not null and r.correlation_id<>last_correlation then
      if r.event_type in ('EXECUTION_RECORDED','MEASUREMENT_RECORDED') then
        violations := violations || jsonb_build_array(jsonb_build_object('code','CORRELATION_CHAIN_BREAK','eventId',r.id,'expected',last_correlation,'actual',r.correlation_id));
      end if;
    end if;

    if r.event_type in ('EXECUTION_RECORDED','MEASUREMENT_RECORDED') then last_correlation := r.correlation_id; end if;
    expected_prev := r.event_hash;
  end loop;

  return jsonb_build_object('missionId',p_mission_id,'ok',jsonb_array_length(violations)=0,'eventsChecked',checked,'finalState',current_state,'violations',violations);
end;
$$;

revoke all on function public.ce_verify_audit_trail(uuid) from public,anon,authenticated;
grant execute on function public.ce_verify_audit_trail(uuid) to service_role;
