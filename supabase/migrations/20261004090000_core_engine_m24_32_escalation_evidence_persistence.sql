create table if not exists public.ce_recovery_escalation_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recovery_key text not null,
  idempotency_key text not null,
  decision_hash text not null,
  level text not null check (level in ('STANDARD_APPROVAL','ENHANCED_REVIEW','MANUAL_ESCALATION')),
  verified boolean not null,
  approval_allowed boolean not null,
  evidence_hash text not null,
  verified_at timestamptz not null,
  checks jsonb not null default '[]'::jsonb,
  failures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, recovery_key, idempotency_key)
);

alter table public.ce_recovery_escalation_evidence enable row level security;
create index if not exists ce_recovery_escalation_evidence_scope_idx
  on public.ce_recovery_escalation_evidence(tenant_id, recovery_key, created_at desc);

create or replace function public.ce_recovery_escalation_evidence_commit(
  p_tenant_id uuid,
  p_recovery_key text,
  p_idempotency_key text,
  p_decision_hash text,
  p_level text,
  p_verified boolean,
  p_approval_allowed boolean,
  p_evidence_hash text,
  p_verified_at timestamptz,
  p_checks jsonb,
  p_failures jsonb
) returns jsonb language plpgsql as $$
declare existing record;
begin
  if p_tenant_id is null
     or coalesce(p_recovery_key,'')=''
     or coalesce(p_idempotency_key,'')=''
     or coalesce(p_decision_hash,'')=''
     or coalesce(p_evidence_hash,'')=''
  then raise exception 'RECOVERY_ESCALATION_EVIDENCE_INPUT_INVALID'; end if;

  select * into existing
  from public.ce_recovery_escalation_evidence
  where tenant_id=p_tenant_id
    and recovery_key=p_recovery_key
    and idempotency_key=p_idempotency_key
  limit 1;

  if found then
    if existing.decision_hash <> p_decision_hash
       or existing.evidence_hash <> p_evidence_hash
    then raise exception 'RECOVERY_ESCALATION_EVIDENCE_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object(
      'evidenceId',existing.id,'tenantId',existing.tenant_id,'recoveryKey',existing.recovery_key,
      'idempotencyKey',existing.idempotency_key,'decisionHash',existing.decision_hash,
      'level',existing.level,'verified',existing.verified,'approvalAllowed',existing.approval_allowed,
      'evidence',jsonb_build_object('evidenceHash',existing.evidence_hash,'verifiedAt',existing.verified_at,'checks',existing.checks,'failures',existing.failures),
      'createdAt',existing.created_at,'status','IDEMPOTENT'
    );
  end if;

  insert into public.ce_recovery_escalation_evidence(
    tenant_id,recovery_key,idempotency_key,decision_hash,level,verified,approval_allowed,
    evidence_hash,verified_at,checks,failures
  ) values (
    p_tenant_id,p_recovery_key,p_idempotency_key,p_decision_hash,p_level,p_verified,p_approval_allowed,
    p_evidence_hash,p_verified_at,p_checks,p_failures
  );

  return jsonb_build_object(
    'evidenceId',(select id from public.ce_recovery_escalation_evidence where tenant_id=p_tenant_id and recovery_key=p_recovery_key and idempotency_key=p_idempotency_key),
    'tenantId',p_tenant_id,'recoveryKey',p_recovery_key,'idempotencyKey',p_idempotency_key,
    'decisionHash',p_decision_hash,'level',p_level,'verified',p_verified,'approvalAllowed',p_approval_allowed,
    'evidence',jsonb_build_object('evidenceHash',p_evidence_hash,'verifiedAt',p_verified_at,'checks',p_checks,'failures',p_failures),
    'createdAt',now(),'status','CREATED'
  );
end; $$;

revoke all on function public.ce_recovery_escalation_evidence_commit(uuid,text,text,text,text,boolean,boolean,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ce_recovery_escalation_evidence_commit(uuid,text,text,text,text,boolean,boolean,text,timestamptz,jsonb,jsonb) to service_role;

create or replace function public.ce_recovery_escalation_evidence_read(
  p_tenant_id uuid,
  p_recovery_key text
) returns jsonb language plpgsql as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'evidenceId',id,'tenantId',tenant_id,'recoveryKey',recovery_key,'idempotencyKey',idempotency_key,
      'decisionHash',decision_hash,'level',level,'verified',verified,'approvalAllowed',approval_allowed,
      'evidence',jsonb_build_object('evidenceHash',evidence_hash,'verifiedAt',verified_at,'checks',checks,'failures',failures),
      'createdAt',created_at
    ) order by created_at desc)
    from public.ce_recovery_escalation_evidence
    where tenant_id=p_tenant_id and recovery_key=p_recovery_key
  ),'[]'::jsonb);
end; $$;

revoke all on function public.ce_recovery_escalation_evidence_read(uuid,text) from public,anon,authenticated;
grant execute on function public.ce_recovery_escalation_evidence_read(uuid,text) to service_role;
