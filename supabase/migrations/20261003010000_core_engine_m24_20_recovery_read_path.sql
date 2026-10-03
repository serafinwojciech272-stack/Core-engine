create index if not exists ce_recovery_commits_tenant_recovery_created_idx
  on public.ce_recovery_commits (tenant_id, recovery_key, created_at desc);

create or replace function public.ce_recovery_read(
  p_tenant_id uuid,
  p_recovery_key text,
  p_idempotency_key text default null
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
  if p_tenant_id is null or coalesce(trim(p_recovery_key), '') = '' then
    raise exception using errcode = 'P0001', message = 'RECOVERY_READ_QUERY_INVALID';
  end if;

  if p_idempotency_key is not null then
    select *
      into v_commit
      from public.ce_recovery_commits
     where tenant_id = p_tenant_id
       and recovery_key = p_recovery_key
       and idempotency_key = p_idempotency_key
     limit 1;
  else
    select *
      into v_commit
      from public.ce_recovery_commits
     where tenant_id = p_tenant_id
       and recovery_key = p_recovery_key
     order by created_at desc
     limit 1;
  end if;

  if not found then
    return null;
  end if;

  select *
    into v_checkpoint
    from public.ce_recovery_checkpoints
   where commit_id = v_commit.id;

  select *
    into v_learning
    from public.ce_recovery_learning
   where commit_id = v_commit.id;

  return jsonb_build_object(
    'commitId', v_commit.id,
    'tenantId', v_commit.tenant_id,
    'recoveryKey', v_commit.recovery_key,
    'idempotencyKey', v_commit.idempotency_key,
    'payloadHash', v_commit.payload_hash,
    'createdAt', v_commit.created_at,
    'checkpoint', jsonb_build_object(
      'streamKey', v_checkpoint.stream_key,
      'cursor', v_checkpoint.cursor,
      'state', v_checkpoint.state
    ),
    'learning',
      case
        when v_learning.id is null then null
        else jsonb_build_object(
          'lessonType', v_learning.lesson_type,
          'quality', v_learning.quality,
          'lesson', v_learning.lesson,
          'reason', v_learning.reason,
          'delta', v_learning.delta,
          'deltaPct', v_learning.delta_pct
        )
      end
  );
end;
$$;

revoke all on function public.ce_recovery_read(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.ce_recovery_read(uuid, text, text)
  to service_role;
