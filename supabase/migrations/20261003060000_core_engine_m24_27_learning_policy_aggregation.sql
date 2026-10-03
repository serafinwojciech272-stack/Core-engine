create table if not exists public.ce_recovery_learning_policies (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null, recovery_key text not null,
 action text not null check(action in ('RESUME','REPLAY','RECONCILE')),
 sample_count integer not null, success_count integer not null, partial_count integer not null,
 failed_count integer not null, unverified_count integer not null, net_weight integer not null,
 confidence_bps integer not null check(confidence_bps between 0 and 10000),
 policy_version integer not null check(policy_version > 0),
 source text not null check(source='PROMOTED_LEARNING'),
 aggregated_at timestamptz not null, created_at timestamptz not null default now(),
 unique(tenant_id,recovery_key,action)
);
alter table public.ce_recovery_learning_policies enable row level security;
create index if not exists ce_recovery_learning_policies_scope_idx on public.ce_recovery_learning_policies(tenant_id,recovery_key);

create or replace function public.ce_recovery_learning_policy_aggregate(p_tenant_id uuid,p_recovery_key text)
returns jsonb language plpgsql as $$
declare r record; result jsonb:='[]'::jsonb; v_version integer;
begin
 if p_tenant_id is null or coalesce(p_recovery_key,'')='' then raise exception 'RECOVERY_LEARNING_POLICY_INPUT_INVALID'; end if;
 for r in select action,
   count(*) filter(where status='PROMOTED') sample_count,
   count(*) filter(where status='PROMOTED' and outcome='SUCCESS') success_count,
   count(*) filter(where status='PROMOTED' and outcome='PARTIAL') partial_count,
   count(*) filter(where status='PROMOTED' and outcome='FAILED') failed_count,
   count(*) filter(where outcome='UNVERIFIED') unverified_count,
   coalesce(sum(weight_delta) filter(where status='PROMOTED'),0) net_weight,
   coalesce(round(avg(confidence_bps) filter(where status='PROMOTED')),0)::integer confidence_bps
 from public.ce_recovery_learning_promotions
 where tenant_id=p_tenant_id and recovery_key=p_recovery_key
 group by action
 loop
   v_version:=greatest(r.sample_count,1);
   insert into public.ce_recovery_learning_policies(tenant_id,recovery_key,action,sample_count,success_count,partial_count,failed_count,unverified_count,net_weight,confidence_bps,policy_version,source,aggregated_at)
   values(p_tenant_id,p_recovery_key,r.action,r.sample_count,r.success_count,r.partial_count,r.failed_count,r.unverified_count,r.net_weight,r.confidence_bps,v_version,'PROMOTED_LEARNING',now())
   on conflict(tenant_id,recovery_key,action) do update set sample_count=excluded.sample_count,success_count=excluded.success_count,partial_count=excluded.partial_count,failed_count=excluded.failed_count,unverified_count=excluded.unverified_count,net_weight=excluded.net_weight,confidence_bps=excluded.confidence_bps,policy_version=excluded.policy_version,aggregated_at=excluded.aggregated_at;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('tenantId',tenant_id,'recoveryKey',recovery_key,'action',action,'sampleCount',sample_count,'successCount',success_count,'partialCount',partial_count,'failedCount',failed_count,'unverifiedCount',unverified_count,'netWeight',net_weight,'confidenceBps',confidence_bps,'policyVersion',policy_version,'source',source,'aggregatedAt',aggregated_at) order by action),'[]'::jsonb)
 into result from public.ce_recovery_learning_policies where tenant_id=p_tenant_id and recovery_key=p_recovery_key;
 return result;
end; $$;
revoke all on function public.ce_recovery_learning_policy_aggregate(uuid,text) from public,anon,authenticated;
grant execute on function public.ce_recovery_learning_policy_aggregate(uuid,text) to service_role;

create or replace function public.ce_recovery_learning_policy_read(p_tenant_id uuid,p_recovery_key text)
returns jsonb language plpgsql as $$
begin
 return coalesce((select jsonb_agg(jsonb_build_object('tenantId',tenant_id,'recoveryKey',recovery_key,'action',action,'sampleCount',sample_count,'successCount',success_count,'partialCount',partial_count,'failedCount',failed_count,'unverifiedCount',unverified_count,'netWeight',net_weight,'confidenceBps',confidence_bps,'policyVersion',policy_version,'source',source,'aggregatedAt',aggregated_at) order by action) from public.ce_recovery_learning_policies where tenant_id=p_tenant_id and recovery_key=p_recovery_key),'[]'::jsonb);
end; $$;
revoke all on function public.ce_recovery_learning_policy_read(uuid,text) from public,anon,authenticated;
grant execute on function public.ce_recovery_learning_policy_read(uuid,text) to service_role;