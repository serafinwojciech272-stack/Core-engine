create table if not exists public.ce_recovery_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recovery_key text not null,
  idempotency_key text not null,
  decision_hash text not null,
  decision jsonb not null,
  action text not null check (action in ('APPROVE', 'REJECT')),
  actor_id text not null,
  actor_kind text not null check (actor_kind in ('human', 'system', 'agent', 'anonymous')),
  execution_permission text not null check (execution_permission in ('GRANTED', 'DENIED')),
  reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists ce_recovery_approvals_tenant_recovery_created_idx
  on public.ce_recovery_approvals (tenant_id, recovery_key, created_at desc);

alter table public.ce_recovery_approvals enable row level security;

create or replace function public.ce_recovery_approval_commit(
  p_tenant_id uuid,
  p_recovery_key text,
  p_idempotency_key text,
  p_decision_hash text,
  p_decision jsonb,
  p_action text,
  p_actor_id text,
  p_actor_kind text,
  p_reason text default null
) returns jsonb
language plpgsql
as $$
declare
  v_existing public.ce_recovery_approvals%rowtype;
  v_id uuid;
  v_permission text;
  v_decision text;
  v_requires_approval boolean;
begin
  if p_tenant_id is null
     or coalesce(trim(p_recovery_key), '') = ''
     or coalesce(trim(p_idempotency_key), '') = ''
     or coalesce(trim(p_decision_hash), '') = ''
     or p_decision is null
     or p_action not in ('APPROVE', 'REJECT')
     or coalesce(trim(p_actor_id), '') = ''
     or p_actor_kind <> 'human' then
    raise exception using errcode = 'P0001', message = 'RECOVERY_APPROVAL_INPUT_INVALID';
  end if;

  if (p_decision->>'tenantId')::uuid <> p_tenant_id
     or p_decision->>'recoveryKey' <> p_recovery_key
     or p_decision->>'source' <> 'RECOVERY_STATE' then
    raise exception using errcode = 'P0001', message = 'RECOVERY_APPROVAL_DECISION_SCOPE_MISMATCH';
  end if;

  select * into v_existing
    from public.ce_recovery_approvals
   where tenant_id = p_tenant_id
     and idempotency_key = p_idempotency_key
   limit 1;

  if found then
    if v_existing.decision_hash <> p_decision_hash or v_existing.action <> p_action then
      raise exception using errcode = 'P0001', message = 'RECOVERY_APPROVAL_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'status', 'IDEMPOTENT',
      'approvalId', v_existing.id,
      'tenantId', v_existing.tenant_id,
      'recoveryKey', v_existing.recovery_key,
      'decision', v_existing.decision->>'decision',
      'decisionHash', v_existing.decision_hash,
      'action', v_existing.action,
      'executionPermission', v_existing.execution_permission,
      'approvedBy', v_existing.actor_id,
      'approvedAt', v_existing.created_at,
      'reason', v_existing.reason
    );
  end if;

  v_decision := p_decision->>'decision';
  v_requires_approval := coalesce((p_decision->>'requiresApproval')::boolean, false);
  v_permission := case
    when p_action = 'APPROVE' and v_requires_approval and v_decision <> 'NO_ACTION' then 'GRANTED'
    else 'DENIED'
  end;

  insert into public.ce_recovery_approvals (
    tenant_id, recovery_key, idempotency_key, decision_hash, decision,
    action, actor_id, actor_kind, execution_permission, reason
  ) values (
    p_tenant_id, p_recovery_key, p_idempotency_key, p_decision_hash, p_decision,
    p_action, p_actor_id, p_actor_kind, v_permission, p_reason
  ) returning id into v_id;

  return jsonb_build_object(
    'status', case when p_action = 'APPROVE' then 'APPROVED' else 'REJECTED' end,
    'approvalId', v_id,
    'tenantId', p_tenant_id,
    'recoveryKey', p_recovery_key,
    'decision', v_decision,
    'decisionHash', p_decision_hash,
    'action', p_action,
    'executionPermission', v_permission,
    'approvedBy', p_actor_id,
    'approvedAt', now(),
    'reason', p_reason
  );
end;
$$;

revoke all on function public.ce_recovery_approval_commit(uuid, text, text, text, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.ce_recovery_approval_commit(uuid, text, text, text, jsonb, text, text, text)
  to service_role;
