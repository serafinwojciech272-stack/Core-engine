-- ADR-003: capability-based routing. A run lists the worker capabilities it needs (e.g. 'sandbox');
-- a worker only claims runs whose requirements it covers. Runs without requirements go to any worker.
alter table public.ce_agent_jobs add column if not exists requires text[] not null default '{}';

create index if not exists ce_agent_jobs_requires_idx on public.ce_agent_jobs using gin (requires) where status in ('QUEUED','RUNNING');

create or replace function public.ce_agent_job_claim_v2(p_owner text, p_lease_seconds integer, p_capabilities text[] default '{}')
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
  where (j.status = 'QUEUED'
         or (j.status = 'RUNNING' and (j.lease_expires_at is null or j.lease_expires_at < now())))
    and j.requires <@ coalesce(p_capabilities, '{}')
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

revoke all on function public.ce_agent_job_claim_v2(text, integer, text[]) from public, anon, authenticated;
grant execute on function public.ce_agent_job_claim_v2(text, integer, text[]) to service_role;

-- Make the new column/function visible to the REST API immediately.
notify pgrst, 'reload schema';
