create index if not exists ce_learning_signals_run_idx on public.ce_learning_signals(run_id, created_at desc);

alter table public.oe_proposal_access enable row level security;

drop policy if exists oe_proposal_access_internal_only on public.oe_proposal_access;

create policy oe_proposal_access_internal_only
on public.oe_proposal_access
for all
to anon, authenticated
using (false)
with check (false);
