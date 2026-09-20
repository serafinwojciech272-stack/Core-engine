create extension if not exists pgcrypto;

create table if not exists public.ce_decisions (
  id uuid primary key,
  diagnosis text not null,
  recommendation text not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  priority text not null check (priority in ('HIGH','MEDIUM','LOW')),
  evidence jsonb not null default '[]'::jsonb,
  engine_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ce_missions (
  id uuid primary key,
  decision_id uuid not null references public.ce_decisions(id) on delete restrict,
  objective text not null,
  state text not null,
  kpi text not null,
  execution_count integer not null default 0,
  engine_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state in ('DISCOVERED','DIAGNOSED','PROPOSED','AWAITING_APPROVAL','APPROVED','EXECUTING','MEASURING','COMPLETED','LEARNED','FAILED','REJECTED','EXPIRED'))
);

create table if not exists public.ce_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.ce_missions(id) on delete cascade,
  decision_id uuid references public.ce_decisions(id) on delete set null,
  event_type text not null,
  from_state text,
  to_state text,
  actor_type text not null check (actor_type in ('system','human','agent')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ce_action_claims (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.ce_missions(id) on delete cascade,
  action text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (mission_id, action, idempotency_key)
);

create table if not exists public.ce_learning (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.ce_missions(id) on delete cascade,
  lesson_type text not null,
  quality text not null,
  improved boolean,
  delta double precision,
  delta_pct double precision,
  lesson text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ce_prediction_ledger (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.ce_decisions(id) on delete restrict,
  mission_id uuid not null unique references public.ce_missions(id) on delete cascade,
  engine_version text not null,
  p1r double precision not null,
  p2r double precision not null,
  p3r double precision not null,
  expected_r double precision,
  risk_gate text not null,
  prediction_source text not null,
  calibration_status text not null,
  outcome_status text not null default 'OPEN' check (outcome_status in ('OPEN','WON','LOST','UNRESOLVED')),
  realized_r double precision,
  outcome_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.ce_program_runs (
  id uuid primary key,
  objective text not null,
  status text not null,
  scope jsonb not null,
  stages jsonb not null,
  next_stage integer,
  version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ce_program_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.ce_program_runs(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ce_events_mission_created_idx on public.ce_events(mission_id, created_at desc);
create index if not exists ce_learning_created_idx on public.ce_learning(created_at desc);
create index if not exists ce_program_events_program_created_idx on public.ce_program_events(program_id, created_at desc);
create index if not exists ce_prediction_created_idx on public.ce_prediction_ledger(created_at desc);

create or replace function public.ce_create_decision_mission(
  p_decision_id uuid,p_diagnosis text,p_recommendation text,p_confidence double precision,p_priority text,p_evidence jsonb,
  p_mission_id uuid,p_objective text,p_state text,p_kpi text,p_engine_version text,
  p_p1r double precision,p_p2r double precision,p_p3r double precision,p_expected_r double precision,
  p_risk_gate text,p_prediction_source text,p_calibration_status text
) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  insert into ce_decisions(id,diagnosis,recommendation,confidence,priority,evidence,engine_version)
  values(p_decision_id,p_diagnosis,p_recommendation,p_confidence,p_priority,p_evidence,p_engine_version)
  on conflict (id) do nothing;
  insert into ce_missions(id,decision_id,objective,state,kpi,engine_version)
  values(p_mission_id,p_decision_id,p_objective,p_state,p_kpi,p_engine_version);
  insert into ce_events(mission_id,decision_id,event_type,to_state,actor_type,metadata)
  values(p_mission_id,p_decision_id,'MISSION_CREATED',p_state,'system','{"source":"ce_create_decision_mission"}'::jsonb);
  if p_p1r is not null and p_p2r is not null and p_p3r is not null then
    insert into ce_prediction_ledger(decision_id,mission_id,engine_version,p1r,p2r,p3r,expected_r,risk_gate,prediction_source,calibration_status)
    values(p_decision_id,p_mission_id,p_engine_version,p_p1r,p_p2r,p_p3r,p_expected_r,p_risk_gate,p_prediction_source,p_calibration_status)
    on conflict (mission_id) do nothing;
  end if;
  return jsonb_build_object('mission_id',p_mission_id,'decision_id',p_decision_id);
exception when unique_violation then
  return jsonb_build_object('mission_id',p_mission_id,'decision_id',p_decision_id,'duplicate',true);
end $$;

create or replace function public.ce_claim_action(p_mission_id uuid,p_action text,p_idempotency_key text)
returns table(claimed boolean,mission_id uuid,action text,idempotency_key text)
language plpgsql security definer set search_path=public as $$
begin
  insert into ce_action_claims(mission_id,action,idempotency_key)
  values(p_mission_id,p_action,p_idempotency_key)
  on conflict (mission_id,action,idempotency_key) do nothing;
  return query select exists(select 1 from ce_action_claims c where c.mission_id=p_mission_id and c.action=p_action and c.idempotency_key=p_idempotency_key) and
    (select count(*) from ce_action_claims c where c.mission_id=p_mission_id and c.action=p_action and c.idempotency_key=p_idempotency_key)=1,
    p_mission_id,p_action,p_idempotency_key;
end $$;

create or replace function public.ce_transition_mission(p_mission_id uuid,p_next_state text,p_actor_type text)
returns table(mission_id uuid,decision_id uuid,from_state text,to_state text,execution_count integer)
language plpgsql security definer set search_path=public as $$
declare m ce_missions%rowtype;
begin
  select * into m from ce_missions where id=p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if not exists(select 1 from (values
    ('DISCOVERED','DIAGNOSED'),('DIAGNOSED','PROPOSED'),('PROPOSED','AWAITING_APPROVAL'),
    ('AWAITING_APPROVAL','APPROVED'),('AWAITING_APPROVAL','REJECTED'),('AWAITING_APPROVAL','EXPIRED'),
    ('APPROVED','EXECUTING'),('APPROVED','REJECTED'),('EXECUTING','MEASURING'),('EXECUTING','FAILED'),
    ('MEASURING','COMPLETED'),('MEASURING','FAILED'),('COMPLETED','LEARNED'),('FAILED','EXECUTING'),('FAILED','REJECTED')
  ) t(a,b) where t.a=m.state and t.b=p_next_state) then raise exception 'INVALID_TRANSITION'; end if;
  if p_next_state in ('APPROVED','REJECTED','EXPIRED') and p_actor_type<>'human' then raise exception 'HUMAN_ACTOR_REQUIRED'; end if;
  if p_next_state in ('EXECUTING','MEASURING','COMPLETED','LEARNED','FAILED') and p_actor_type<>'system' then raise exception 'SYSTEM_ACTOR_REQUIRED'; end if;
  update ce_missions set state=p_next_state,execution_count=execution_count+case when p_next_state='EXECUTING' then 1 else 0 end,updated_at=now() where id=p_mission_id
  returning id,decision_id,m.state,state,execution_count into mission_id,decision_id,from_state,to_state,execution_count;
  insert into ce_events(mission_id,decision_id,event_type,from_state,to_state,actor_type)
  values(p_mission_id,m.decision_id,'STATE_CHANGED',m.state,p_next_state,p_actor_type);
  return next;
end $$;

create or replace function public.ce_record_mission_outcome(p_mission_id uuid,p_event_type text,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare did uuid;
begin
  select decision_id into did from ce_missions where id=p_mission_id;
  if did is null then raise exception 'MISSION_NOT_FOUND'; end if;
  insert into ce_events(mission_id,decision_id,event_type,metadata,actor_type)
  values(p_mission_id,did,p_event_type,p_metadata,'system');
  return jsonb_build_object('recorded',true);
end $$;

create or replace function public.ce_record_learning(
  p_mission_id uuid,p_lesson_type text,p_quality text,p_improved boolean,p_delta double precision,p_delta_pct double precision,p_lesson text,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare did uuid;
begin
  select decision_id into did from ce_missions where id=p_mission_id;
  if did is null then raise exception 'MISSION_NOT_FOUND'; end if;
  insert into ce_learning(mission_id,lesson_type,quality,improved,delta,delta_pct,lesson,reason)
  values(p_mission_id,p_lesson_type,p_quality,p_improved,p_delta,p_delta_pct,p_lesson,p_reason);
  insert into ce_events(mission_id,decision_id,event_type,metadata,actor_type)
  values(p_mission_id,did,'LEARNING_RECORDED',jsonb_build_object('quality',p_quality,'lesson',p_lesson),'system');
  return jsonb_build_object('recorded',true);
end $$;

create or replace function public.ce_resolve_prediction(p_mission_id uuid,p_realized_r double precision,p_outcome_status text,p_outcome_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  update ce_prediction_ledger set realized_r=p_realized_r,outcome_status=p_outcome_status,outcome_payload=p_outcome_payload,resolved_at=now() where mission_id=p_mission_id;
  return jsonb_build_object('resolved',found);
end $$;

alter table public.ce_decisions enable row level security;
alter table public.ce_missions enable row level security;
alter table public.ce_events enable row level security;
alter table public.ce_action_claims enable row level security;
alter table public.ce_learning enable row level security;
alter table public.ce_prediction_ledger enable row level security;
alter table public.ce_program_runs enable row level security;
alter table public.ce_program_events enable row level security;

revoke all on all tables in schema public from anon,authenticated;
grant all on all tables in schema public to service_role;
revoke all on all functions in schema public from anon,authenticated;
grant execute on function public.ce_create_decision_mission(uuid,text,text,double precision,text,jsonb,uuid,text,text,text,text,double precision,double precision,double precision,double precision,text,text,text) to service_role;
grant execute on function public.ce_claim_action(uuid,text,text) to service_role;
grant execute on function public.ce_transition_mission(uuid,text,text) to service_role;
grant execute on function public.ce_record_mission_outcome(uuid,text,jsonb) to service_role;
grant execute on function public.ce_record_learning(uuid,text,text,boolean,double precision,double precision,text,text) to service_role;
grant execute on function public.ce_resolve_prediction(uuid,double precision,text,jsonb) to service_role;
