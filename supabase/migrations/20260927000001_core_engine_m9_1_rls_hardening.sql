-- M9.1 security hardening for commercial runtime tables
create index if not exists ce_usage_events_mission_idx on public.ce_usage_events(mission_id);

drop policy if exists ce_tenants_deny_all on public.ce_tenants;
drop policy if exists ce_mission_tenants_deny_all on public.ce_mission_tenants;
drop policy if exists ce_usage_events_deny_all on public.ce_usage_events;

create policy ce_tenants_deny_all on public.ce_tenants
  for all to public using (false) with check (false);

create policy ce_mission_tenants_deny_all on public.ce_mission_tenants
  for all to public using (false) with check (false);

create policy ce_usage_events_deny_all on public.ce_usage_events
  for all to public using (false) with check (false);
