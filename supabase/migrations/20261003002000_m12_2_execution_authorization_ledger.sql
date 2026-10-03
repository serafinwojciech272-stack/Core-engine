create table if not exists public.ce_agent_execution_authorizations (
  id uuid primary key default gen_random_uuid(),
  composition_id uuid not null references public.ce_agent_compositions(id) on delete cascade,
  tenant_id text not null,
  mission_id uuid not null references public.ce_missions(id) on delete cascade,
  capability_id text not null,
  correlation_id text not null,
  status text not null default 'AUTHORIZED' check (status in ('AUTHORIZED','CONSUMED','REVOKED','EXPIRED')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists ce_agent_exec_auth_correlation_uidx on public.ce_agent_execution_authorizations(correlation_id);
create index if not exists ce_agent_exec_auth_mission_idx on public.ce_agent_execution_authorizations(mission_id,created_at desc);
alter table public.ce_agent_execution_authorizations enable row level security;
revoke all on public.ce_agent_execution_authorizations from public,anon,authenticated;
grant select,insert,update on public.ce_agent_execution_authorizations to service_role;

drop function if exists public.ce_enforce_agent_execution(uuid,text,uuid,text,text);
create or replace function public.ce_enforce_agent_execution(
  p_composition_id uuid,p_tenant_id text,p_mission_id uuid,p_capability_id text,p_correlation_id text
) returns table(allowed boolean,reason text,composition_status text,approval_status text,mission_state text,authorization_id uuid)
language plpgsql security definer set search_path=''
as $$
declare c public.ce_agent_compositions%rowtype;a public.ce_agent_approvals%rowtype;m public.ce_missions%rowtype;auth_id uuid;
begin
 select * into c from public.ce_agent_compositions where id=p_composition_id and tenant_id=p_tenant_id for update;
 if not found then return query select false,'COMPOSITION_NOT_FOUND',null,null,null,null; return; end if;
 select * into a from public.ce_agent_approvals where composition_id=c.id for update;
 if not found then return query select false,'APPROVAL_OBJECT_NOT_FOUND',c.status,null,null,null; return; end if;
 select * into m from public.ce_missions where id=p_mission_id for update;
 if not found then return query select false,'MISSION_NOT_FOUND',c.status,a.status,null,null; return; end if;
 if c.mission_id is distinct from p_mission_id then return query select false,'MISSION_BINDING_MISMATCH',c.status,a.status,m.state,null; return; end if;
 if c.capability_id <> p_capability_id then return query select false,'CAPABILITY_SCOPE_MISMATCH',c.status,a.status,m.state,null; return; end if;
 if c.correlation_id <> p_correlation_id or a.correlation_id <> p_correlation_id then return query select false,'CORRELATION_MISMATCH',c.status,a.status,m.state,null; return; end if;
 if a.status <> 'APPROVED' or c.status <> 'APPROVED' then return query select false,'APPROVAL_REQUIRED',c.status,a.status,m.state,null; return; end if;
 if m.state not in ('APPROVED','EXECUTING') then return query select false,'MISSION_STATE_NOT_EXECUTABLE',c.status,a.status,m.state,null; return; end if;
 select id into auth_id from public.ce_agent_execution_authorizations where correlation_id=p_correlation_id and status='AUTHORIZED' for update;
 if auth_id is not null then return query select true,'EXECUTION_ALREADY_AUTHORIZED',c.status,a.status,m.state,auth_id; return; end if;
 if m.state='APPROVED' then
   update public.ce_missions set state='EXECUTING',updated_at=now() where id=m.id;
   insert into public.ce_events(mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata)
   values(m.id,m.decision_id,'STATE_CHANGED','APPROVED','EXECUTING','system',jsonb_build_object('source','M12.2','composition_id',c.id,'correlation_id',p_correlation_id));
 end if;
 insert into public.ce_agent_execution_authorizations(composition_id,tenant_id,mission_id,capability_id,correlation_id)
 values(c.id,c.tenant_id,m.id,c.capability_id,c.correlation_id) returning id into auth_id;
 return query select true,'EXECUTION_AUTHORIZED',c.status,a.status,'EXECUTING',auth_id;
end;
$$;
revoke all on function public.ce_enforce_agent_execution(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ce_enforce_agent_execution(uuid,text,uuid,text,text) to service_role;

drop function if exists public.ce_close_agent_execution(uuid,uuid,boolean,text);
create or replace function public.ce_close_agent_execution(p_composition_id uuid,p_authorization_id uuid,p_success boolean,p_reason text default null)
returns table(composition_status text,mission_state text,result text)
language plpgsql security definer set search_path=''
as $$
declare c public.ce_agent_compositions%rowtype;m public.ce_missions%rowtype;a public.ce_agent_execution_authorizations%rowtype;
begin
 select * into a from public.ce_agent_execution_authorizations where id=p_authorization_id and composition_id=p_composition_id for update;
 if not found then raise exception 'EXECUTION_AUTHORIZATION_NOT_FOUND'; end if;
 if a.status <> 'AUTHORIZED' then raise exception 'EXECUTION_AUTHORIZATION_NOT_ACTIVE'; end if;
 select * into c from public.ce_agent_compositions where id=p_composition_id for update;
 select * into m from public.ce_missions where id=c.mission_id for update;
 if m.state not in ('EXECUTING','MEASURING') then raise exception 'MISSION_STATE_NOT_CLOSABLE'; end if;
 update public.ce_agent_execution_authorizations set status='CONSUMED',consumed_at=now(),metadata=jsonb_build_object('success',p_success,'reason',p_reason) where id=a.id;
 if p_success then update public.ce_agent_compositions set status='EXECUTED',updated_at=now() where id=c.id; return query select 'EXECUTED',m.state,'EXECUTION_RECORDED';
 else update public.ce_agent_compositions set status='CLOSED',updated_at=now() where id=c.id; return query select 'CLOSED',m.state,'EXECUTION_FAILED'; end if;
end;
$$;
revoke all on function public.ce_close_agent_execution(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.ce_close_agent_execution(uuid,uuid,boolean,text) to service_role;
