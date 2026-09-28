-- M11.4 Learning Consolidation
-- Provenance link from reusable strategies to the recovery patterns that produced them.
alter table public.ce_intelligence_strategies
  add column if not exists source_recovery_pattern_ids uuid[] not null default '{}';

create index if not exists ce_intel_strategies_recovery_sources
  on public.ce_intelligence_strategies using gin(source_recovery_pattern_ids);
