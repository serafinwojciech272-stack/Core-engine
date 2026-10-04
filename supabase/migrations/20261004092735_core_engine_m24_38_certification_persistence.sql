create table if not exists public.ce_recovery_certifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recovery_key text not null,
  idempotency_key text not null,
  certification_hash text not null,
  certification jsonb not null,
  certified_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint ce_recovery_certifications_identity_unique
    unique (tenant_id, recovery_key, idempotency_key),
  constraint ce_recovery_certifications_hash_format
    check (certification_hash ~ '^[0-9a-f]{64}$')
);

alter table public.ce_recovery_certifications enable row level security;

drop policy if exists deny_all_anon on public.ce_recovery_certifications;
create policy deny_all_anon on public.ce_recovery_certifications
  for all to anon using (false) with check (false);

drop policy if exists deny_all_authenticated on public.ce_recovery_certifications;
create policy deny_all_authenticated on public.ce_recovery_certifications
  for all to authenticated using (false) with check (false);

create index if not exists ce_recovery_certifications_lookup_idx
  on public.ce_recovery_certifications (tenant_id, recovery_key, idempotency_key);

create or replace function public.ce_persist_recovery_certification(
  p_tenant_id uuid,
  p_recovery_key text,
  p_idempotency_key text,
  p_certification_hash text,
  p_certification jsonb,
  p_certified_at timestamptz
)
returns public.ce_recovery_certifications
language plpgsql
set search_path = public, pg_temp
as $$
declare
  existing public.ce_recovery_certifications;
begin
  if p_tenant_id is null or p_recovery_key = '' or p_idempotency_key = '' then
    raise exception 'RECOVERY_CERTIFICATION_IDENTITY_MISSING';
  end if;

  if p_certification_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'RECOVERY_CERTIFICATION_HASH_INVALID';
  end if;

  select * into existing
  from public.ce_recovery_certifications
  where tenant_id = p_tenant_id
    and recovery_key = p_recovery_key
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if existing.certification_hash <> p_certification_hash
       or existing.certification <> p_certification
       or existing.certified_at <> p_certified_at then
      raise exception 'RECOVERY_CERTIFICATION_IDEMPOTENCY_CONFLICT';
    end if;
    return existing;
  end if;

  insert into public.ce_recovery_certifications(
    tenant_id, recovery_key, idempotency_key,
    certification_hash, certification, certified_at
  ) values (
    p_tenant_id, p_recovery_key, p_idempotency_key,
    p_certification_hash, p_certification, p_certified_at
  )
  returning * into existing;

  return existing;
end;
$$;

create or replace function public.ce_read_recovery_certification(
  p_tenant_id uuid,
  p_recovery_key text,
  p_idempotency_key text
)
returns public.ce_recovery_certifications
language sql
set search_path = public, pg_temp
as $$
  select *
  from public.ce_recovery_certifications
  where tenant_id = p_tenant_id
    and recovery_key = p_recovery_key
    and idempotency_key = p_idempotency_key;
$$;

revoke all on function public.ce_persist_recovery_certification(
  uuid, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;

revoke all on function public.ce_read_recovery_certification(
  uuid, text, text
) from public, anon, authenticated;

grant execute on function public.ce_persist_recovery_certification(
  uuid, text, text, text, jsonb, timestamptz
) to service_role;

grant execute on function public.ce_read_recovery_certification(
  uuid, text, text
) to service_role;
