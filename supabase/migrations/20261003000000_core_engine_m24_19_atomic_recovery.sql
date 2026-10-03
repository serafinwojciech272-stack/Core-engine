create table if not exists public.ce_recovery_commits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  idempotency_key text not null,
  recovery_key text not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  unique(tenant_id, idempotency_key)
);

create table if not exists public.ce_recovery_checkpoints (
  id uuid primary key default gen_random_uuid(),
  commit_id uuid not null references public.ce_recovery_commits(id) on delete cascade,
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  stream_key text not null,
  cursor text not null,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(commit_id)
);

create table if not exists public.ce_recovery_learning (
  id uuid primary key default gen_random_uuid(),
  commit_id uuid not null references public.ce_recovery_commits(id) on delete cascade,
  tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
  lesson_type text not null,
  quality text not null,
  delta numeric,
  delta_pct numeric,
  lesson text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique(commit_id)
);

alter table public.ce_recovery_commits enable row level security;
alter table public.ce_recovery_checkpoints enable row level security;
alter table public.ce_recovery_learning enable row level security;

revoke all on public.ce_recovery_commits, public.ce_recovery_checkpoints, public.ce_recovery_learning from anon, authenticated;
grant all on public.ce_recovery_commits, public.ce_recovery_checkpoints, public.ce_recovery_learning to service_role;

create or replace function public.ce_atomic_recovery_commit(
  p_tenant_id uuid,
  p_idempotency_key text,
  p_recovery_key text,
  p_payload_hash text,
  p_checkpoint jsonb,
  p_learning jsonb default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commit public.ce_recovery_commits%rowtype;
  v_checkpoint public.ce_recovery_checkpoints%rowtype;
  v_learning public.ce_recovery_learning%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_idempotency_key, 0));

  select * into v_commit
  from public.ce_recovery_commits
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_commit.payload_hash <> p_payload_hash then
      raise exception using errcode = 'P0001', message = 'RECOVERY_IDEMPOTENCY_CONFLICT';
    end if;

    select * into v_checkpoint from public.ce_recovery_checkpoints where commit_id = v_commit.id;
    select * into v_learning from public.ce_recovery_learning where commit_id = v_commit.id;

    return jsonb_build_object(
      'status','IDEMPOTENT',
      'commitId',v_commit.id,
      'checkpointId',v_checkpoint.id,
      'learningId',v_learning.id,
      'payloadHash',v_commit.payload_hash
    );
  end if;

  insert into public.ce_recovery_commits(tenant_id,idempotency_key,recovery_key,payload_hash)
  values(p_tenant_id,p_idempotency_key,p_recovery_key,p_payload_hash)
  returning * into v_commit;

  insert into public.ce_recovery_checkpoints(commit_id,tenant_id,stream_key,cursor,state)
  values(
    v_commit.id,p_tenant_id,
    coalesce(p_checkpoint->>'streamKey',''),
    coalesce(p_checkpoint->>'cursor',''),
    coalesce(p_checkpoint->'state','{}'::jsonb)
  )
  returning * into v_checkpoint;

  if p_learning is not null then
    insert into public.ce_recovery_learning(
      commit_id,tenant_id,lesson_type,quality,delta,delta_pct,lesson,reason
    )
    values(
      v_commit.id,p_tenant_id,
      coalesce(p_learning->>'lessonType','UNVERIFIED'),
      coalesce(p_learning->>'quality','UNVERIFIED'),
      (p_learning->>'delta')::numeric,
      (p_learning->>'deltaPct')::numeric,
      coalesce(p_learning->>'lesson',''),
      coalesce(p_learning->>'reason','')
    )
    returning * into v_learning;
  end if;

  return jsonb_build_object(
    'status','COMMITTED',
    'commitId',v_commit.id,
    'checkpointId',v_checkpoint.id,
    'learningId',case when p_learning is null then null else v_learning.id end,
    'payloadHash',v_commit.payload_hash
  );
end;
$$;

revoke all on function public.ce_atomic_recovery_commit(uuid,text,text,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ce_atomic_recovery_commit(uuid,text,text,text,jsonb,jsonb,jsonb) to service_role;
