-- Explicit deny-all policies for service-role/RPC controlled tables.
create policy "deny_all_authenticated" on public.ce_billing_subscriptions for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_billing_subscriptions for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_billing_usage for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_billing_usage for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_production_certifications for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_production_certifications for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_products for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_products for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_recovery_drills for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_recovery_drills for all to anon using (false) with check (false);