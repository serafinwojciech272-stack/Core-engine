create table if not exists public.ce_recovery_executions (
 id uuid primary key,
 tenant_id uuid not null,
 recovery_key text not null,
 idempotency_key text not null,
 approval_id uuid not null,
 decision_hash text not null,
 execution_hash text not null,
 action text not null check (action in ('RESUME','REPLAY','RECONCILE')),
 status text not null check (status in ('EXECUTED','NOOP','FAILED')),
 executed_by text not null,
 executed_at timestamptz not null,
 state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique (tenant_id,idempotency_key)
);
alter table public.ce_recovery_executions enable row level security;
create index if not exists ce_recovery_executions_tenant_recovery_created_idx on public.ce_recovery_executions(tenant_id,recovery_key,created_at desc);

create table if not exists public.ce_recovery_verifications (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 recovery_key text not null,
 execution_id uuid not null,
 action text not null check (action in ('RESUME','REPLAY','RECONCILE')),
 outcome text not null check (outcome in ('SUCCESS','PARTIAL','FAILED','UNVERIFIED')),
 learning_signal text not null check (learning_signal in ('POSITIVE','NEUTRAL','NEGATIVE')),
 matched_keys jsonb not null default '[]'::jsonb,
 mismatched_keys jsonb not null default '[]'::jsonb,
 verification_hash text not null,
 verified_at timestamptz not null,
 reason text not null,
 observed_state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique (tenant_id,execution_id)
);
alter table public.ce_recovery_verifications enable row level security;
create index if not exists ce_recovery_verifications_tenant_recovery_created_idx on public.ce_recovery_verifications(tenant_id,recovery_key,created_at desc);

create or replace function public.ce_recovery_execution_commit(
 p_execution_id uuid,p_tenant_id uuid,p_recovery_key text,p_idempotency_key text,p_approval_id uuid,p_decision_hash text,p_execution_hash text,p_action text,p_status text,p_executed_by text,p_executed_at timestamptz,p_state jsonb
) returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare v public.ce_recovery_executions%rowtype;
begin
 if p_execution_id is null or p_tenant_id is null or coalesce(trim(p_recovery_key),'')='' or coalesce(trim(p_idempotency_key),'')='' or p_approval_id is null or p_action not in ('RESUME','REPLAY','RECONCILE') or p_status not in ('EXECUTED','NOOP','FAILED') then raise exception using errcode='P0001',message='RECOVERY_EXECUTION_INPUT_INVALID'; end if;
 select * into v from public.ce_recovery_executions where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key limit 1;
 if found then
  if v.execution_hash<>p_execution_hash or v.approval_id<>p_approval_id then raise exception using errcode='P0001',message='RECOVERY_EXECUTION_IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('executionId',v.id,'executionHash',v.execution_hash,'status',v.status);
 end if;
 if not exists(select 1 from public.ce_recovery_approvals a where a.id=p_approval_id and a.tenant_id=p_tenant_id and a.recovery_key=p_recovery_key and a.decision_hash=p_decision_hash and a.action='APPROVE' and a.execution_permission='GRANTED') then raise exception using errcode='P0001',message='RECOVERY_EXECUTION_PERMISSION_DENIED'; end if;
 insert into public.ce_recovery_executions(id,tenant_id,recovery_key,idempotency_key,approval_id,decision_hash,execution_hash,action,status,executed_by,executed_at,state) values(p_execution_id,p_tenant_id,p_recovery_key,p_idempotency_key,p_approval_id,p_decision_hash,p_execution_hash,p_action,p_status,p_executed_by,p_executed_at,coalesce(p_state,'{}'::jsonb));
 return jsonb_build_object('executionId',p_execution_id,'executionHash',p_execution_hash,'status',p_status);
end; $$;
revoke all on function public.ce_recovery_execution_commit(uuid,uuid,text,text,uuid,text,text,text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.ce_recovery_execution_commit(uuid,uuid,text,text,uuid,text,text,text,text,text,timestamptz,jsonb) to service_role;

create or replace function public.ce_recovery_execution_read(
 p_tenant_id uuid, p_recovery_key text, p_execution_id uuid
) returns jsonb
language sql
set search_path = pg_catalog, public
as $$
 select case when e.id is null then null else jsonb_build_object(
   'executionId',e.id,'tenantId',e.tenant_id,'recoveryKey',e.recovery_key,
   'action',e.action,'status',e.status,'approvalId',e.approval_id,
   'decisionHash',e.decision_hash,'executionHash',e.execution_hash,
   'executedBy',e.executed_by,'executedAt',e.executed_at,'checkpoint',e.state
 ) end
 from public.ce_recovery_executions e
 where e.id=p_execution_id and e.tenant_id=p_tenant_id and e.recovery_key=p_recovery_key
 limit 1;
$$;
revoke all on function public.ce_recovery_execution_read(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.ce_recovery_execution_read(uuid,text,uuid) to service_role;

create or replace function public.ce_recovery_verification_commit(
 p_tenant_id uuid,p_recovery_key text,p_execution_id uuid,p_action text,p_outcome text,p_learning_signal text,p_matched_keys jsonb,p_mismatched_keys jsonb,p_verification_hash text,p_verified_at timestamptz,p_reason text,p_observed_state jsonb
) returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare v public.ce_recovery_verifications%rowtype;
begin
 if p_tenant_id is null or coalesce(trim(p_recovery_key),'')='' or p_execution_id is null or p_action not in ('RESUME','REPLAY','RECONCILE') or p_outcome not in ('SUCCESS','PARTIAL','FAILED','UNVERIFIED') or p_learning_signal not in ('POSITIVE','NEUTRAL','NEGATIVE') then raise exception using errcode='P0001',message='RECOVERY_VERIFICATION_INPUT_INVALID'; end if;
 if not exists(select 1 from public.ce_recovery_executions e where e.id=p_execution_id and e.tenant_id=p_tenant_id and e.recovery_key=p_recovery_key and e.status='EXECUTED') then raise exception using errcode='P0001',message='RECOVERY_EXECUTION_NOT_FOUND'; end if;
 select * into v from public.ce_recovery_verifications where tenant_id=p_tenant_id and execution_id=p_execution_id limit 1;
 if found then
  if v.verification_hash<>p_verification_hash then raise exception using errcode='P0001',message='RECOVERY_VERIFICATION_IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('verificationId',v.id,'outcome',v.outcome,'learningSignal',v.learning_signal,'verificationHash',v.verification_hash);
 end if;
 insert into public.ce_recovery_verifications(tenant_id,recovery_key,execution_id,action,outcome,learning_signal,matched_keys,mismatched_keys,verification_hash,verified_at,reason,observed_state) values(p_tenant_id,p_recovery_key,p_execution_id,p_action,p_outcome,p_learning_signal,coalesce(p_matched_keys,'[]'::jsonb),coalesce(p_mismatched_keys,'[]'::jsonb),p_verification_hash,p_verified_at,p_reason,coalesce(p_observed_state,'{}'::jsonb)) returning * into v;
 return jsonb_build_object('verificationId',v.id,'outcome',v.outcome,'learningSignal',v.learning_signal,'verificationHash',v.verification_hash);
end; $$;
revoke all on function public.ce_recovery_verification_commit(uuid,text,uuid,text,text,text,jsonb,jsonb,text,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.ce_recovery_verification_commit(uuid,text,uuid,text,text,text,jsonb,jsonb,text,timestamptz,text,jsonb) to service_role;

create or replace function public.ce_recovery_verification_read(p_tenant_id uuid,p_recovery_key text) returns jsonb
language sql
set search_path = pg_catalog, public
as $$
 select case when v.id is null then null else jsonb_build_object('verificationId',v.id,'tenantId',v.tenant_id,'recoveryKey',v.recovery_key,'executionId',v.execution_id,'action',v.action,'outcome',v.outcome,'learningSignal',v.learning_signal,'matchedKeys',v.matched_keys,'mismatchedKeys',v.mismatched_keys,'verificationHash',v.verification_hash,'verifiedAt',v.verified_at,'reason',v.reason,'observedState',v.observed_state) end
 from public.ce_recovery_verifications v where v.tenant_id=p_tenant_id and v.recovery_key=p_recovery_key order by v.created_at desc limit 1;
$$;
revoke all on function public.ce_recovery_verification_read(uuid,text) from public,anon,authenticated;
grant execute on function public.ce_recovery_verification_read(uuid,text) to service_role;
