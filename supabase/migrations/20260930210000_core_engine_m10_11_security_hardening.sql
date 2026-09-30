-- M10.11 production security hardening
-- Keep internal trigger functions callable only by the database trigger path.
alter table public.growth_decision_memory enable row level security;
revoke all on public.growth_decision_memory from anon, authenticated;
grant all on public.growth_decision_memory to service_role;

revoke execute on function public.sync_growth_decision_memory() from public, anon, authenticated;
revoke execute on function public.sync_growth_decision_memory_outcome() from public, anon, authenticated;

alter function public.set_website_projects_updated_at() set search_path = public;
