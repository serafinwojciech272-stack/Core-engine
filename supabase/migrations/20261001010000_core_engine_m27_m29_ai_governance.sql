create table if not exists public.ce_model_definitions (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
 model_key text not null, provider text not null, model_version text not null, context_window integer not null check(context_window>0),
 structured_output boolean not null default false, enabled boolean not null default true, created_at timestamptz not null default now(),
 unique(tenant_id,model_key,model_version)
);
create table if not exists public.ce_model_policies (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
 policy_key text not null, allowed_providers jsonb not null default '[]'::jsonb, allowed_models jsonb not null default '[]'::jsonb,
 max_input_tokens integer not null check(max_input_tokens>=0), max_output_tokens integer not null check(max_output_tokens>0),
 require_structured_output boolean not null default true, version text not null, expires_at timestamptz not null, created_at timestamptz not null default now(),
 unique(tenant_id,policy_key,version)
);
create table if not exists public.ce_inference_requests (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
 request_key text not null, actor_id text not null, mission_id uuid references public.ce_missions(id) on delete set null,
 model_key text not null, provider text not null, prompt_version text not null, context_version text not null,
 input_tokens integer not null check(input_tokens>=0), max_output_tokens integer not null check(max_output_tokens>0),
 schema_id text, request_hash text not null, status text not null default 'REQUESTED', created_at timestamptz not null default now(),
 unique(tenant_id,request_key)
);
create table if not exists public.ce_inference_results (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
 request_id uuid not null references public.ce_inference_requests(id) on delete cascade, model_version text not null,
 input_tokens integer not null, output_tokens integer not null, cached_tokens integer not null default 0,
 latency_ms integer not null, cost numeric(20,8) not null default 0, response_hash text, structured boolean not null default false,
 validation_errors jsonb not null default '[]'::jsonb, status text not null, created_at timestamptz not null default now(),
 unique(request_id)
);
create table if not exists public.ce_data_policies (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
 policy_key text not null, classification text not null, retention_ms bigint not null check(retention_ms>=0),
 allow_export boolean not null default false, allow_model_input boolean not null default false, version text not null,
 unique(tenant_id,policy_key,version)
);
create table if not exists public.ce_data_lineage (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
 data_id text not null, source text not null, parent_ids jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.ce_evaluation_runs (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.ce_tenants(id) on delete cascade,
 definition_key text not null, version text not null, mode text not null, status text not null default 'RUNNING',
 metrics jsonb not null default '[]'::jsonb, sample_size integer not null default 0, created_at timestamptz not null default now()
);
do $$ declare t text; begin foreach t in array array['ce_model_definitions','ce_model_policies','ce_inference_requests','ce_inference_results','ce_data_policies','ce_data_lineage','ce_evaluation_runs'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); execute format('grant all on public.%I to service_role',t); end loop; end $$;
