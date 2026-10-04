-- Core Engine security hardening
-- Records the live hardening applied to Supabase:
-- 1) pin ce_fcc_validate_journal search_path
-- 2) make explicit deny policies for RLS-protected tables that previously had no policies.
alter function public.ce_fcc_validate_journal(uuid) set search_path = public;

do $$
declare r record;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='r'
      and c.relrowsecurity=true
      and not exists (
        select 1 from pg_policies p
        where p.schemaname='public' and p.tablename=c.relname
      )
  loop
    execute format('create policy %I on public.%I for all to authenticated using (false) with check (false)',
      'deny_all_authenticated', r.table_name);
    execute format('create policy %I on public.%I for all to anon using (false) with check (false)',
      'deny_all_anon', r.table_name);
  end loop;
end $$;
