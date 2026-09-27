create or replace function public.ce_claim_capability_execution(p_tenant_id uuid,p_mission_id uuid,p_action text,p_idempotency_key text,p_request_hash text)
returns table(claim_mode text,execution_id uuid,status text,request_hash text,receipt jsonb,error_message text)
language plpgsql security definer set search_path = ''
as $$
declare existing public.ce_capability_executions%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key))=0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  insert into public.ce_capability_executions(tenant_id,mission_id,action,idempotency_key,request_hash,status)
  values(p_tenant_id,p_mission_id,p_action,p_idempotency_key,p_request_hash,'EXECUTING')
  on conflict (tenant_id,action,idempotency_key) do nothing;
  if found then
    return query
      select 'NEW'::text,e.id,e.status,e.request_hash,e.receipt,e.error_message
      from public.ce_capability_executions e
      where e.tenant_id=p_tenant_id and e.action=p_action and e.idempotency_key=p_idempotency_key;
    return;
  end if;
  select e.* into existing from public.ce_capability_executions e
    where e.tenant_id=p_tenant_id and e.action=p_action and e.idempotency_key=p_idempotency_key for update;
  if existing.request_hash <> p_request_hash then
    return query select 'CONFLICT'::text,existing.id,existing.status,existing.request_hash,existing.receipt,existing.error_message; return;
  end if;
  if existing.status='EXECUTED' then
    return query select 'REPLAY'::text,existing.id,existing.status,existing.request_hash,existing.receipt,existing.error_message; return;
  end if;
  if existing.status='EXECUTING' and existing.updated_at > now()-interval '5 minutes' then
    return query select 'IN_PROGRESS'::text,existing.id,existing.status,existing.request_hash,existing.receipt,existing.error_message; return;
  end if;
  update public.ce_capability_executions e
    set status='EXECUTING',receipt='{}'::jsonb,error_message=null,started_at=now(),completed_at=null,updated_at=now()
    where e.id=existing.id;
  return query select 'RETRY'::text,existing.id,'EXECUTING'::text,existing.request_hash,'{}'::jsonb,null::text;
end;
$$;

revoke all on function public.ce_claim_capability_execution(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ce_claim_capability_execution(uuid,uuid,text,text,text) to service_role;

drop policy if exists ce_capability_executions_no_anon on public.ce_capability_executions;
create policy ce_capability_executions_no_anon on public.ce_capability_executions for all to anon using (false) with check (false);
drop policy if exists ce_capability_executions_no_authenticated on public.ce_capability_executions;
create policy ce_capability_executions_no_authenticated on public.ce_capability_executions for all to authenticated using (false) with check (false);