-- ADR-001 Phase 2: durable agent runs shared by web and worker services.
-- `data` holds the full run document; status/version/lease columns mirror it for queries and CAS.
create table if not exists public.ce_agent_jobs (
  id uuid primary key,
  tenant_id text not null,
  status text not null check (status in ('QUEUED','RUNNING','WAITING_APPROVAL','COMPLETED','FAILED','BUDGET_EXHAUSTED','CANCELLED')),
  version integer not null default 0,
  lease_owner text,
  lease_expires_at timestamptz,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ce_agent_jobs_runnable_idx on public.ce_agent_jobs (created_at) where status in ('QUEUED','RUNNING');
create index if not exists ce_agent_jobs_tenant_idx on public.ce_agent_jobs (tenant_id, created_at desc);

alter table public.ce_agent_jobs enable row level security;
revoke all on public.ce_agent_jobs from anon, authenticated;
grant all on public.ce_agent_jobs to service_role;
drop policy if exists deny_all_anon on public.ce_agent_jobs;
drop policy if exists deny_all_authenticated on public.ce_agent_jobs;
create policy deny_all_anon on public.ce_agent_jobs for all to anon using (false) with check (false);
create policy deny_all_authenticated on public.ce_agent_jobs for all to authenticated using (false) with check (false);

-- Atomically claims the oldest runnable job (QUEUED, or RUNNING with an expired lease).
-- FOR UPDATE SKIP LOCKED lets several workers poll concurrently without double-claiming.
create or replace function public.ce_agent_job_claim(p_owner text, p_lease_seconds integer)
returns setof public.ce_agent_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_expires timestamptz := now() + make_interval(secs => greatest(p_lease_seconds, 1));
begin
  select j.id into v_id
  from public.ce_agent_jobs j
  where j.status = 'QUEUED'
     or (j.status = 'RUNNING' and (j.lease_expires_at is null or j.lease_expires_at < now()))
  order by j.created_at
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.ce_agent_jobs j
  set status = 'RUNNING',
      lease_owner = p_owner,
      lease_expires_at = v_expires,
      version = j.version + 1,
      updated_at = now(),
      data = j.data
        || jsonb_build_object(
             'status', 'RUNNING',
             'version', j.version + 1,
             'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'lease', jsonb_build_object('owner', p_owner, 'expiresAt', floor(extract(epoch from v_expires) * 1000)::bigint))
  where j.id = v_id
  returning j.*;
end;
$$;

revoke all on function public.ce_agent_job_claim(text, integer) from public, anon, authenticated;
grant execute on function public.ce_agent_job_claim(text, integer) to service_role;
