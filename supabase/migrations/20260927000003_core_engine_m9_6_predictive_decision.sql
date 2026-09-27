alter table public.ce_prediction_ledger
  add column if not exists prediction_payload jsonb not null default '{}'::jsonb;

drop function if exists public.ce_create_decision_mission(
  uuid,text,text,double precision,text,jsonb,uuid,text,text,text,text,double precision,double precision,double precision,double precision,text,text,text
);

create or replace function public.ce_create_decision_mission(
  p_decision_id uuid,p_diagnosis text,p_recommendation text,p_confidence double precision,p_priority text,p_evidence jsonb,
  p_mission_id uuid,p_objective text,p_state text,p_kpi text,p_engine_version text,
  p_p1r double precision,p_p2r double precision,p_p3r double precision,p_expected_r double precision,
  p_risk_gate text,p_prediction_source text,p_calibration_status text,p_prediction_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  insert into ce_decisions(id,diagnosis,recommendation,confidence,priority,evidence,engine_version)
  values(p_decision_id,p_diagnosis,p_recommendation,p_confidence,p_priority,p_evidence,p_engine_version)
  on conflict (id) do nothing;

  insert into ce_missions(id,decision_id,objective,state,kpi,engine_version)
  values(p_mission_id,p_decision_id,p_objective,p_state,p_kpi,p_engine_version);

  insert into ce_events(mission_id,decision_id,event_type,to_state,actor_type,metadata)
  values(p_mission_id,p_decision_id,'MISSION_CREATED',p_state,'system','{"source":"ce_create_decision_mission","stage":"M9.6"}'::jsonb);

  if p_p1r is not null and p_p2r is not null and p_p3r is not null then
    insert into ce_prediction_ledger(
      decision_id,mission_id,engine_version,p1r,p2r,p3r,expected_r,
      risk_gate,prediction_source,calibration_status,prediction_payload
    )
    values(
      p_decision_id,p_mission_id,p_engine_version,p_p1r,p_p2r,p_p3r,p_expected_r,
      p_risk_gate,p_prediction_source,p_calibration_status,p_prediction_payload
    )
    on conflict (mission_id) do update
      set prediction_payload=excluded.prediction_payload;
  end if;

  return jsonb_build_object('mission_id',p_mission_id,'decision_id',p_decision_id);
exception when unique_violation then
  return jsonb_build_object('mission_id',p_mission_id,'decision_id',p_decision_id,'duplicate',true);
end $$;

grant execute on function public.ce_create_decision_mission(
  uuid,text,text,double precision,text,jsonb,uuid,text,text,text,text,
  double precision,double precision,double precision,double precision,
  text,text,text,jsonb
) to service_role;
