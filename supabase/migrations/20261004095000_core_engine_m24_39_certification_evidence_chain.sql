create table if not exists public.ce_recovery_certification_chains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recovery_key text not null,
  idempotency_key text not null,
  evidence_hash text not null,
  evidence_decision_hash text not null,
  reconciliation_hash text not null,
  closure_hash text not null,
  terminal_hash text not null,
  certification_hash text not null,
  chain_hash text not null,
  chain_payload jsonb not null,
  chained_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint ce_recovery_certification_chains_identity_unique unique (tenant_id, recovery_key, idempotency_key),
  constraint ce_recovery_certification_chains_hash_format check (
    evidence_hash ~ '^[0-9a-f]{64}$' and
    evidence_decision_hash ~ '^[0-9a-f]{64}$' and
    reconciliation_hash ~ '^[0-9a-f]{64}$' and
    closure_hash ~ '^[0-9a-f]{64}$' and
    terminal_hash ~ '^[0-9a-f]{64}$' and
    certification_hash ~ '^[0-9a-f]{64}$' and
    chain_hash ~ '^[0-9a-f]{64}$'
  )
);

alter table public.ce_recovery_certification_chains enable row level security;

drop policy if exists deny_all_anon on public.ce_recovery_certification_chains;
create policy deny_all_anon on public.ce_recovery_certification_chains
  for all to anon using (false) with check (false);

drop policy if exists deny_all_authenticated on public.ce_recovery_certification_chains;
create policy deny_all_authenticated on public.ce_recovery_certification_chains
  for all to authenticated using (false) with check (false);

create index if not exists ce_recovery_certification_chains_lookup_idx
  on public.ce_recovery_certification_chains (tenant_id, recovery_key, idempotency_key);

create or replace function public.ce_persist_recovery_certification_chain(
  p_tenant_id uuid,
  p_recovery_key text,
  p_idempotency_key text,
  p_evidence_hash text,
  p_evidence_decision_hash text,
  p_reconciliation_hash text,
  p_closure_hash text,
  p_terminal_hash text,
  p_certification_hash text,
  p_chain_hash text,
  p_chain_payload jsonb,
  p_chained_at timestamptz
)
returns public.ce_recovery_certification_chains
language plpgsql
set search_path = public, pg_temp
as $$
declare existing public.ce_recovery_certification_chains;
begin
  if p_tenant_id is null or p_recovery_key = '' or p_idempotency_key = '' then
    raise exception 'RECOVERY_CHAIN_IDENTITY_MISSING';
  end if;
  if p_chain_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'RECOVERY_CHAIN_HASH_INVALID';
  end if;

  select * into existing
  from public.ce_recovery_certification_chains
  where tenant_id = p_tenant_id
    and recovery_key = p_recovery_key
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if existing.chain_hash <> p_chain_hash
       or existing.chain_payload <> p_chain_payload then
      raise exception 'RECOVERY_CHAIN_IDEMPOTENCY_CONFLICT';
    end if;
    return existing;
  end if;

  insert into public.ce_recovery_certification_chains(
    tenant_id, recovery_key, idempotency_key,
    evidence_hash, evidence_decision_hash, reconciliation_hash,
    closure_hash, terminal_hash, certification_hash, chain_hash,
    chain_payload, chained_at
  ) values (
    p_tenant_id, p_recovery_key, p_idempotency_key,
    p_evidence_hash, p_evidence_decision_hash, p_reconciliation_hash,
    p_closure_hash, p_terminal_hash, p_certification_hash, p_chain_hash,
    p_chain_payload, p_chained_at
  )
  returning * into existing;

  return existing;
end;
$$;

create or replace function public.ce_read_recovery_certification_chain(
  p_tenant_id uuid,
  p_recovery_key text,
  p_idempotency_key text
)
returns public.ce_recovery_certification_chains
language sql
set search_path = public, pg_temp
as $$
  select *
  from public.ce_recovery_certification_chains
  where tenant_id = p_tenant_id
    and recovery_key = p_recovery_key
    and idempotency_key = p_idempotency_key;
$$;

revoke all on function public.ce_persist_recovery_certification_chain(
  uuid, text, text, text, text, text, text, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;

revoke all on function public.ce_read_recovery_certification_chain(
  uuid, text, text
) from public, anon, authenticated;

grant execute on function public.ce_persist_recovery_certification_chain(
  uuid, text, text, text, text, text, text, text, text, text, jsonb, timestamptz
) to service_role;

grant execute on function public.ce_read_recovery_certification_chain(
  uuid, text, text
) to service_role;
