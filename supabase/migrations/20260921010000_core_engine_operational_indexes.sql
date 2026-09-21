-- Core Engine operational indexes.
-- Keeps mission/event/learning/tender lookups bounded as runtime history grows.
create index if not exists ce_missions_state_updated_idx on public.ce_missions(state, updated_at desc);
create index if not exists ce_events_mission_created_idx on public.ce_events(mission_id, created_at desc);
create index if not exists ce_learning_mission_created_idx on public.ce_learning(mission_id, created_at desc);
create index if not exists ce_action_keys_mission_action_idx on public.ce_action_keys(mission_id, action);
create index if not exists ce_prediction_ledger_mission_status_idx on public.ce_prediction_ledger(mission_id, outcome_status);
create index if not exists ce_tender_cases_mission_idx on public.ce_tender_cases(mission_id);
