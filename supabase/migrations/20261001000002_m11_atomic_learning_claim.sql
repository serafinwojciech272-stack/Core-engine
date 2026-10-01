create or replace function public.ce_claim_learning_mission(
  p_mission_id uuid,
  p_idempotency_key text
) returns table(
  claimed boolean,
  claim_mode text,
  mission_id uuid,
  state text
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

  if m.state <> 'COMPLETED' then
    return query select false, 'MISSION_STATE_BLOCKED'::text, m.id, m.state;
    return;
  end if;

  insert into public.ce_action_claims(mission_id, action, idempotency_key)
  values(p_mission_id, 'MISSION_LEARNING', p_idempotency_key)
  on conflict (mission_id, action, idempotency_key) do nothing;

  get diagnostics rows_inserted = row_count;

  if rows_inserted <> 1 then
    return query select false, 'IDEMPOTENCY_REPLAY'::text, m.id, m.state;
    return;
  end if;

  return query select true, 'CLAIMED'::text, m.id, m.state;
end;
$$;

revoke all on function public.ce_claim_learning_mission(uuid,text) from public, anon, authenticated;
grant execute on function public.ce_claim_learning_mission(uuid,text) to service_role;
