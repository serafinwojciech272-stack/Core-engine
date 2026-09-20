create table if not exists public.ce_action_keys (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.ce_missions(id) on delete cascade,
  action text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (mission_id, action, idempotency_key)
);

create table if not exists public.ce_program_checkpoints (
  id uuid primary key,
  program_id uuid not null references public.ce_program_runs(id) on delete cascade,
  stage_id text not null,
  state text not null,
  next_stage integer,
  integrity text not null,
  created_at timestamptz not null default now()
);

alter table public.ce_action_keys enable row level security;
alter table public.ce_program_checkpoints enable row level security;
revoke all on public.ce_action_keys from anon, authenticated;
revoke all on public.ce_program_checkpoints from anon, authenticated;
grant all on public.ce_action_keys to service_role;
grant all on public.ce_program_checkpoints to service_role;

create or replace function public.ce_claim_action(p_mission_id uuid,p_action text,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  rows_inserted integer;
  normalized_key text := trim(p_idempotency_key);
begin
  if p_action not in ('approve','reject','execute','measure','complete','learn','fail','retry','abort') then
    raise exception 'INVALID_ACTION';
  end if;
  if length(normalized_key) < 8 or length(normalized_key) > 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  insert into public.ce_action_keys(mission_id,action,idempotency_key)
  values(p_mission_id,p_action,normalized_key)
  on conflict (mission_id,action,idempotency_key) do nothing;
  get diagnostics rows_inserted = row_count;
  return jsonb_build_object('claimed',rows_inserted=1,'mission_id',p_mission_id,'action',p_action,'idempotency_key',normalized_key);
end;
$$;

grant execute on function public.ce_claim_action(uuid,text,text) to service_role;
