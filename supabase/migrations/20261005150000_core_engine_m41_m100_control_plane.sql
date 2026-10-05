create table if not exists public.ce_intelligence_runs (
 id uuid primary key default gen_random_uuid(),
 tenant_id text not null,
 request_id text not null,
 engine_version text not null default 'M100',
 state text not null check(state in ('READY','INSUFFICIENT_DATA','ABSTAIN','BLOCKED')),
 run_hash text not null check(run_hash ~ '^[0-9a-f]{64}$'),
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(tenant_id,request_id)
);
alter table public.ce_intelligence_runs enable row level security;
drop policy if exists "deny anon intelligence runs" on public.ce_intelligence_runs;
drop policy if exists "deny authenticated intelligence runs" on public.ce_intelligence_runs;
create policy "deny anon intelligence runs" on public.ce_intelligence_runs for all to anon using(false) with check(false);
create policy "deny authenticated intelligence runs" on public.ce_intelligence_runs for all to authenticated using(false) with check(false);
revoke all on public.ce_intelligence_runs from anon,authenticated;
create index if not exists ce_intelligence_runs_tenant_created_idx on public.ce_intelligence_runs(tenant_id,created_at desc);

create table if not exists public.ce_intelligence_stage_events (
 id uuid primary key default gen_random_uuid(),
 tenant_id text not null,
 request_id text not null,
 stage_id text not null check(stage_id ~ '^M([4-9][0-9]|100)$'),
 stage_hash text not null check(stage_hash ~ '^[0-9a-f]{64}$'),
 state text not null,
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.ce_intelligence_stage_events enable row level security;
drop policy if exists "deny anon intelligence stage events" on public.ce_intelligence_stage_events;
drop policy if exists "deny authenticated intelligence stage events" on public.ce_intelligence_stage_events;
create policy "deny anon intelligence stage events" on public.ce_intelligence_stage_events for all to anon using(false) with check(false);
create policy "deny authenticated intelligence stage events" on public.ce_intelligence_stage_events for all to authenticated using(false) with check(false);
revoke all on public.ce_intelligence_stage_events from anon,authenticated;
create index if not exists ce_intelligence_stage_identity_idx on public.ce_intelligence_stage_events(tenant_id,request_id,stage_id,created_at desc);
