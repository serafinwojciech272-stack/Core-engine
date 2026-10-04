-- Core Engine recovery RLS/search_path hardening
-- Recovery tables are service-role/RPC controlled; deny direct client access.
create policy "deny_all_authenticated" on public.ce_recovery_approvals for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_recovery_approvals for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_recovery_checkpoints for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_recovery_checkpoints for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_recovery_commits for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_recovery_commits for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_recovery_escalation_evidence for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_recovery_escalation_evidence for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_recovery_executions for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_recovery_executions for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_recovery_learning for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_recovery_learning for all to anon using (false) with check (false);
create policy "deny_all_authenticated" on public.ce_recovery_verifications for all to authenticated using (false) with check (false);
create policy "deny_all_anon" on public.ce_recovery_verifications for all to anon using (false) with check (false);
alter function public.ce_recovery_escalation_evidence_commit(uuid,text,text,text,text,boolean,boolean,text,timestamptz,jsonb,jsonb) set search_path = pg_catalog, public;
alter function public.ce_recovery_escalation_evidence_read(uuid,text) set search_path = pg_catalog, public;