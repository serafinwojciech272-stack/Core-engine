-- M12.6: orphaned executor recovery / lease reconciliation
-- An expired authorization is not sufficient evidence that no side effect occurred.
-- Recovery classifies the orphan, blocks retry, and requires explicit reconciliation.

create table if not exists public.ce_agent_execution_recoveries (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.ce_agent_execution_authorizations(id) on delete cascade,
  composition_id uuid not null references public.ce_agent_compositions(id) on delete cascade,
  tenant_id text not null,
  mission_id uuid not null references public.ce_missions(id) on delete cascade,
  correlation_id text not null,
  classification text not null check (classification in ('EXPIRED_BEFORE_EXECUTION','UNKNOWN_SIDE_EFFECT')),
  status text not null default 'PENDING_RECOVERY' check (status in ('PENDING_RECOVERY','RETRY_ALLOWED','SIDE_EFFECT_CONFIRMED','CLOSED')),
  detected_at timestamptz not null default now(),
  reconciled_at timestamptz null,
  reconciled_by text null,
  reconciliation_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  unique(authorization_id)
);

alter table public.ce_agent_execution_recoveries enable row level security;
revoke all on public.ce_agent_execution_recoveries from public,anon,authenticated;
grant select,insert,update on public.ce_agent_execution_recoveries to service_role;

create index if not exists ce_agent_exec_recovery_pending_idx
  on public.ce_agent_execution_recoveries(status,detected_at);

create or replace function public.ce_detect_orphaned_agent_executions(
  p_limit integer default 100
) returns table(
  recovery_id uuid,
  authorization_id uuid,
  composition_id uuid,
  tenant_id text,
  mission_id uuid,
  correlation_id text,
  classification text,
  recovery_status text
)
language plpgsql security definer set search_path=''
as $$
declare
  x record;
  recovery_class text;
  recovery_id_value uuid;
begin
  for x in
    select a.*, c.status as composition_status, m.state as mission_state
    from public.ce_agent_execution_authorizations a
    join public.ce_agent_compositions c on c.id=a.composition_id
    join public.ce_missions m on m.id=a.mission_id
    where a.status='AUTHORIZED'
      and a.expires_at <= now()
      and not exists (
        select 1 from public.ce_agent_execution_recoveries r
        where r.authorization_id=a.id
          and r.status in ('PENDING_RECOVERY','RETRY_ALLOWED','SIDE_EFFECT_CONFIRMED')
      )
    order by a.expires_at asc
    limit greatest(1,least(coalesce(p_limit,100),500))
    for update of a
  loop
    if x.mission_state='APPROVED' and x.composition_status='APPROVED' then
      recovery_class := 'EXPIRED_BEFORE_EXECUTION';
    else
      recovery_class := 'UNKNOWN_SIDE_EFFECT';
    end if;

    update public.ce_agent_execution_authorizations
      set status='EXPIRED',
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'source','M12.6',
            'orphan_detected_at',now(),
            'classification',recovery_class
          )
      where id=x.id;

    insert into public.ce_agent_execution_recoveries(
      authorization_id,composition_id,tenant_id,mission_id,correlation_id,classification,metadata
    )
    values(
      x.id,x.composition_id,x.tenant_id,x.mission_id,x.correlation_id,recovery_class,
      jsonb_build_object('composition_status',x.composition_status,'mission_state',x.mission_state)
    )
    on conflict (authorization_id) do update
      set metadata=excluded.metadata
    returning id into recovery_id_value;

    return query
      select recovery_id_value,x.id,x.composition_id,x.tenant_id,x.mission_id,x.correlation_id,
             recovery_class,'PENDING_RECOVERY';
  end loop;
end;
$$;

revoke all on function public.ce_detect_orphaned_agent_executions(integer) from public,anon,authenticated;
grant execute on function public.ce_detect_orphaned_agent_executions(integer) to service_role;

create or replace function public.ce_reconcile_orphaned_agent_execution(
  p_recovery_id uuid,
  p_resolution text,
  p_actor_id text,
  p_reason text,
  p_evidence_ids text[] default '{}'
) returns table(
  resolved boolean,
  result text,
  classification text,
  recovery_status text,
  mission_state text,
  authorization_status text
)
language plpgsql security definer set search_path=''
as $$
declare
  r public.ce_agent_execution_recoveries%rowtype;
  a public.ce_agent_execution_authorizations%rowtype;
  c public.ce_agent_compositions%rowtype;
  m public.ce_missions%rowtype;
begin
  if p_actor_id is null or length(trim(p_actor_id))=0 then
    return query select false,'RECOVERY_ACTOR_REQUIRED',null,null,null,null; return;
  end if;
  if p_reason is null or length(trim(p_reason))=0 then
    return query select false,'RECOVERY_REASON_REQUIRED',null,null,null,null; return;
  end if;
  if p_resolution not in ('NO_SIDE_EFFECT','SIDE_EFFECT_CONFIRMED') then
    return query select false,'RECOVERY_RESOLUTION_INVALID',null,null,null,null; return;
  end if;

  select * into r from public.ce_agent_execution_recoveries
    where id=p_recovery_id for update;
  if not found then
    return query select false,'RECOVERY_NOT_FOUND',null,null,null,null; return;
  end if;

  if r.status <> 'PENDING_RECOVERY' then
    return query select false,'RECOVERY_NOT_PENDING',r.classification,r.status,null,null; return;
  end if;

  select * into a from public.ce_agent_execution_authorizations where id=r.authorization_id for update;
  select * into c from public.ce_agent_compositions where id=r.composition_id for update;
  select * into m from public.ce_missions where id=r.mission_id for update;

  if p_resolution='NO_SIDE_EFFECT' then
    if m.state='APPROVED' then
      null;
    elsif m.state='EXECUTING' then
      update public.ce_missions
        set state='FAILED',updated_at=now()
        where id=m.id;
      insert into public.ce_events(
        mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata
      ) values(
        m.id,m.decision_id,'STATE_CHANGED','EXECUTING','FAILED','system',
        jsonb_build_object('source','M12.6','recovery_id',r.id,'reason',p_reason,'evidenceIds',p_evidence_ids)
      );
      m.state := 'FAILED';
    else
      return query select false,'RECOVERY_MISSION_STATE_NOT_RECONCILIABLE',r.classification,r.status,m.state,a.status; return;
    end if;

    update public.ce_agent_execution_recoveries
      set status='RETRY_ALLOWED',reconciled_at=now(),reconciled_by=trim(p_actor_id),
          reconciliation_reason=trim(p_reason),
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'resolution',p_resolution,'evidenceIds',p_evidence_ids,'source','M12.6'
          )
      where id=r.id;

    return query select true,'RECOVERY_RETRY_ALLOWED',r.classification,'RETRY_ALLOWED',m.state,a.status;
    return;
  end if;

  if m.state='EXECUTING' then
    update public.ce_agent_execution_authorizations
      set status='CONSUMED',consumed_at=coalesce(consumed_at,now()),
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'success',true,'reconciled',true,'source','M12.6','evidenceIds',p_evidence_ids
          )
      where id=a.id;

    update public.ce_agent_compositions set status='EXECUTED',updated_at=now() where id=c.id;
    update public.ce_missions set state='MEASURING',updated_at=now() where id=m.id;

    insert into public.ce_events(
      mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata
    ) values(
      m.id,m.decision_id,'EXECUTION_RECONCILED','EXECUTING','MEASURING','system',
      jsonb_build_object('source','M12.6','recovery_id',r.id,'reason',p_reason,'evidenceIds',p_evidence_ids)
    );

    update public.ce_agent_execution_recoveries
      set status='SIDE_EFFECT_CONFIRMED',reconciled_at=now(),reconciled_by=trim(p_actor_id),
          reconciliation_reason=trim(p_reason),
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'resolution',p_resolution,'evidenceIds',p_evidence_ids,'source','M12.6'
          )
      where id=r.id;

    return query select true,'RECOVERY_SIDE_EFFECT_CONFIRMED',r.classification,'SIDE_EFFECT_CONFIRMED','MEASURING','CONSUMED';
    return;
  end if;

  return query select false,'RECOVERY_SIDE_EFFECT_STATE_NOT_RECONCILIABLE',r.classification,r.status,m.state,a.status;
end;
$$;

revoke all on function public.ce_reconcile_orphaned_agent_execution(uuid,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.ce_reconcile_orphaned_agent_execution(uuid,text,text,text,text[]) to service_role;
