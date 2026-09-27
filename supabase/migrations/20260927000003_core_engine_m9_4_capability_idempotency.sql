create table if not exists public.ce_capability_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  mission_id uuid references public.ce_missions(id) on delete cascade,
  action text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null check (status in ('EXECUTING','EXECUTED','FAILED')),
  receipt jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tenant_id, action, idempotency_key)
);

create index if not exists ce_capability_executions_tenant_created_idx
  on public.ce_capability_executions(tenant_id, created_at desc);
create index if not exists ce_capability_executions_mission_created_idx
  on public.ce_capability_executions(mission_id, created_at desc);
create index if not exists ce_capability_executions_status_updated_idx
  on public.ce_capability_executions(status, updated_at);

alter table public.ce_capability_executions enable row level security;
revoke all on public.ce_capability_executions from anon, authenticated;
grant all on public.ce_capability_executions to service_role;

create or replace function public.ce_claim_capability_execution(
  p_tenant_id uuid,
  p_mission_id uuid,
  p_action text,
  p_idempotency_key text,
  p_request_hash text
) returns table(
  claim_mode text,
  execution_id uuid,
  status text,
  request_hash text,
  receipt jsonb,
  error_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare existing public.ce_capability_executions%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  insert into public.ce_capability_executions(
    tenant_id, mission_id, action, idempotency_key, request_hash, status
  )
  values (
    p_tenant_id, p_mission_id, p_action, p_idempotency_key, p_request_hash, 'EXECUTING'
  )
  on conflict (tenant_id, action, idempotency_key) do nothing;

  if found then
    return query select
      'NEW'::text,
      (select id from public.ce_capability_executions
       where tenant_id=p_tenant_id and action=p_action and idempotency_key=p_idempotency_key),
      'EXECUTING'::text,
      p_request_hash,
      '{}'::jsonb,
      null::text;
    return;
  end if;

  select * into existing
  from public.ce_capability_executions
  where tenant_id=p_tenant_id and action=p_action and idempotency_key=p_idempotency_key
  for update;

  if existing.request_hash <> p_request_hash then
    return query select 'CONFLICT'::text, existing.id, existing.status,
      existing.request_hash, existing.receipt, existing.error_message;
    return;
  end if;

  if existing.status = 'EXECUTED' then
    return query select 'REPLAY'::text, existing.id, existing.status,
      existing.request_hash, existing.receipt, existing.error_message;
    return;
  end if;

  if existing.status = 'EXECUTING'
     and existing.updated_at > now() - interval '5 minutes' then
    return query select 'IN_PROGRESS'::text, existing.id, existing.status,
      existing.request_hash, existing.receipt, existing.error_message;
    return;
  end if;

  update public.ce_capability_executions
  set status='EXECUTING',
      receipt='{}'::jsonb,
      error_message=null,
      started_at=now(),
      completed_at=null,
      updated_at=now()
  where id=existing.id;

  return query select 'RETRY'::text, existing.id, 'EXECUTING'::text,
    existing.request_hash, '{}'::jsonb, null::text;
end;
$$;

create or replace function public.ce_complete_capability_execution(
  p_execution_id uuid,
  p_status text,
  p_receipt jsonb default '{}'::jsonb,
  p_error_message text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('EXECUTED','FAILED') then
    raise exception 'INVALID_EXECUTION_STATUS';
  end if;

  update public.ce_capability_executions
  set status=p_status,
      receipt=coalesce(p_receipt,'{}'::jsonb),
      error_message=p_error_message,
      completed_at=now(),
      updated_at=now()
  where id=p_execution_id;

  if not found then
    raise exception 'CAPABILITY_EXECUTION_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'updated', true,
    'execution_id', p_execution_id,
    'status', p_status
  );
end;
$$;

revoke all on function public.ce_claim_capability_execution(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.ce_complete_capability_execution(uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.ce_claim_capability_execution(uuid,uuid,text,text,text) to service_role;
grant execute on function public.ce_complete_capability_execution(uuid,text,jsonb,text) to service_role;