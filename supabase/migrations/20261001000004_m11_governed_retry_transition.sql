create or replace function public.ce_transition_mission(p_mission_id uuid,p_next_state text,p_actor_type text)
returns table(mission_id uuid,decision_id uuid,from_state text,to_state text,execution_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare m public.ce_missions%rowtype;
begin
  select * into m from public.ce_missions where id=p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;

  if not exists(select 1 from (values
    ('DISCOVERED','DIAGNOSED'),('DIAGNOSED','PROPOSED'),('PROPOSED','AWAITING_APPROVAL'),
    ('AWAITING_APPROVAL','APPROVED'),('AWAITING_APPROVAL','REJECTED'),('AWAITING_APPROVAL','EXPIRED'),
    ('APPROVED','EXECUTING'),('APPROVED','REJECTED'),
    ('EXECUTING','MEASURING'),('EXECUTING','FAILED'),
    ('MEASURING','COMPLETED'),('MEASURING','FAILED'),
    ('COMPLETED','LEARNED'),
    ('FAILED','APPROVED'),('FAILED','REJECTED')
  ) t(a,b) where t.a=m.state and t.b=p_next_state)
  then raise exception 'INVALID_TRANSITION'; end if;

  if p_next_state in ('APPROVED','REJECTED','EXPIRED') and p_actor_type<>'human'
  then raise exception 'HUMAN_ACTOR_REQUIRED'; end if;

  if p_next_state in ('EXECUTING','MEASURING','COMPLETED','LEARNED','FAILED') and p_actor_type<>'system'
  then raise exception 'SYSTEM_ACTOR_REQUIRED'; end if;

  update public.ce_missions
  set state=p_next_state,
      execution_count=execution_count+case when p_next_state='EXECUTING' then 1 else 0 end,
      updated_at=now()
  where id=p_mission_id
  returning id,decision_id,m.state,state,execution_count
  into mission_id,decision_id,from_state,to_state,execution_count;

  insert into public.ce_events(mission_id,decision_id,event_type,from_state,to_state,actor_type,metadata)
  values(
    p_mission_id,m.decision_id,'STATE_CHANGED',m.state,p_next_state,p_actor_type,
    jsonb_build_object('source','GOVERNED_RETRY_TRANSITION')
  );

  return next;
end;
$$;

revoke all on function public.ce_transition_mission(uuid,text,text) from public, anon, authenticated;
grant execute on function public.ce_transition_mission(uuid,text,text) to service_role;
