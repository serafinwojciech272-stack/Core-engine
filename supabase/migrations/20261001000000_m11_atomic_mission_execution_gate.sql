create or replace function public.ce_claim_and_start_mission(
  p_mission_id uuid,
  p_action text,
  p_idempotency_key text
) returns table(
  started boolean,
  claim_mode text,
  mission_id uuid,
  from_state text,
  to_state text,
  execution_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.ce_missions%rowtype;
  rows_inserted integer;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into m
  from public.ce_missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'MISSION_NOT_FOUND';
  end if;

  if m.state <> 'APPROVED' then
    return query select
      false,
      'MISSION_STATE_BLOCKED'::text,
      m.id,
      m.state,
      m.state,
      m.execution_count;
    return;
  end if;

  insert into public.ce_action_claims(mission_id, action, idempotency_key)
  values(p_mission_id, p_action, p_idempotency_key)
  on conflict (mission_id, action, idempotency_key) do nothing;

  get diagnostics rows_inserted = row_count;

  if rows_inserted <> 1 then
    return query select
      false,
      'IDEMPOTENCY_REPLAY'::text,
      m.id,
      m.state,
      m.state,
      m.execution_count;
    return;
  end if;

  update public.ce_missions
  set state = 'EXECUTING',
      execution_count = execution_count + 1,
      updated_at = now()
  where id = p_mission_id
  returning id, m.state, state, execution_count
  into mission_id, from_state, to_state, execution_count;

  insert into public.ce_events(
    mission_id, decision_id, event_type, from_state, to_state, actor_type, metadata
  )
  values(
    m.id, m.decision_id, 'STATE_CHANGED', m.state, 'EXECUTING', 'system',
    jsonb_build_object(
      'source', 'ATOMIC_MISSION_EXECUTION_GATE',
      'action', p_action,
      'idempotency_key', p_idempotency_key
    )
  );

  return query select
    true,
    'STARTED'::text,
    mission_id,
    from_state,
    to_state,
    execution_count;
end;
$$;

revoke all on function public.ce_claim_and_start_mission(uuid,text,text) from public, anon, authenticated;
grant execute on function public.ce_claim_and_start_mission(uuid,text,text) to service_role;
