create table if not exists public.ce_recovery_learning_promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recovery_key text not null,
  execution_id uuid not null,
  action text not null check (action in ('RESUME','REPLAY','RECONCILE')),
  outcome text not null check (outcome in ('SUCCESS','PARTIAL','FAILED','UNVERIFIED')),
  learning_signal text not null check (learning_signal in ('POSITIVE','NEUTRAL','NEGATIVE')),
  status text not null check (status in ('PROMOTED','NO_PROMOTION')),
  weight_delta integer not null check (weight_delta in (-1,0,1)),
  confidence_bps integer not null check (confidence_bps between 0 and 10000),
  basis text not null check (basis in ('SUCCESS','PARTIAL','FAILED','UNVERIFIED')),
  learning_version integer not null check (learning_version > 0),
  promotion_hash text not null,
  promoted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, execution_id)
);

create index if not exists ce_recovery_learning_promotions_scope_idx
  on public.ce_recovery_learning_promotions (tenant_id, recovery_key, promoted_at desc);

alter table public.ce_recovery_learning_promotions enable row level security;

create or replace function public.ce_recovery_learning_promotion_commit(
  p_tenant_id uuid,
  p_recovery_key text,
  p_execution_id uuid,
  p_action text,
  p_outcome text,
  p_learning_signal text,
  p_status text,
  p_weight_delta integer,
  p_confidence_bps integer,
  p_basis text,
  p_learning_version integer,
  p_promotion_hash text,
  p_promoted_at timestamptz
) returns jsonb
language plpgsql
as $$
declare
  existing jsonb;
  inserted jsonb;
begin
  if p_tenant_id is null or coalesce(p_recovery_key,'') = '' or p_execution_id is null then
    raise exception 'RECOVERY_LEARNING_PROMOTION_INPUT_INVALID';
  end if;

  select jsonb_build_object(
    'tenantId', tenant_id,
    'recoveryKey', recovery_key,
    'executionId', execution_id,
    'action', action,
    'outcome', outcome,
    'learningSignal', learning_signal,
    'status', status,
    'policyUpdate', jsonb_build_object(
      'action', action,
      'weightDelta', weight_delta,
      'confidenceBps', confidence_bps,
      'basis', basis
    ),
    'learningVersion', learning_version,
    'promotionHash', promotion_hash,
    'promotedAt', promoted_at
  )
  into existing
  from public.ce_recovery_learning_promotions
  where tenant_id = p_tenant_id and execution_id = p_execution_id;

  if existing is not null then
    if existing->>'promotionHash' <> p_promotion_hash then
      raise exception 'RECOVERY_LEARNING_PROMOTION_CONFLICT';
    end if;
    return existing;
  end if;

  insert into public.ce_recovery_learning_promotions (
    tenant_id, recovery_key, execution_id, action, outcome, learning_signal,
    status, weight_delta, confidence_bps, basis, learning_version,
    promotion_hash, promoted_at
  ) values (
    p_tenant_id, p_recovery_key, p_execution_id, p_action, p_outcome, p_learning_signal,
    p_status, p_weight_delta, p_confidence_bps, p_basis, p_learning_version,
    p_promotion_hash, p_promoted_at
  )
  returning jsonb_build_object(
    'tenantId', tenant_id,
    'recoveryKey', recovery_key,
    'executionId', execution_id,
    'action', action,
    'outcome', outcome,
    'learningSignal', learning_signal,
    'status', status,
    'policyUpdate', jsonb_build_object(
      'action', action,
      'weightDelta', weight_delta,
      'confidenceBps', confidence_bps,
      'basis', basis
    ),
    'learningVersion', learning_version,
    'promotionHash', promotion_hash,
    'promotedAt', promoted_at
  ) into inserted;

  return inserted;
end;
$$;

revoke all on function public.ce_recovery_learning_promotion_commit(
  uuid,text,uuid,text,text,text,text,integer,integer,text,integer,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.ce_recovery_learning_promotion_commit(
  uuid,text,uuid,text,text,text,text,integer,integer,text,integer,text,timestamptz
) to service_role;

create or replace function public.ce_recovery_learning_promotion_read(
  p_tenant_id uuid,
  p_recovery_key text
) returns jsonb
language plpgsql
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'tenantId', tenant_id,
    'recoveryKey', recovery_key,
    'executionId', execution_id,
    'action', action,
    'outcome', outcome,
    'learningSignal', learning_signal,
    'status', status,
    'policyUpdate', jsonb_build_object(
      'action', action,
      'weightDelta', weight_delta,
      'confidenceBps', confidence_bps,
      'basis', basis
    ),
    'learningVersion', learning_version,
    'promotionHash', promotion_hash,
    'promotedAt', promoted_at
  )
  into result
  from public.ce_recovery_learning_promotions
  where tenant_id = p_tenant_id and recovery_key = p_recovery_key
  order by promoted_at desc
  limit 1;

  return result;
end;
$$;

revoke all on function public.ce_recovery_learning_promotion_read(uuid,text) from public, anon, authenticated;
grant execute on function public.ce_recovery_learning_promotion_read(uuid,text) to service_role;
