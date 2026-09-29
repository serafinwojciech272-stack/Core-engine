create extension if not exists vector with schema extensions;

alter table public.ce_intelligence_memories
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedding_dimensions integer,
  add column if not exists embedding_hash text,
  add column if not exists embedding_updated_at timestamptz;

create index if not exists ce_intel_mem_embedding_hnsw
  on public.ce_intelligence_memories
  using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists ce_intel_mem_embedding_hash_idx
  on public.ce_intelligence_memories (tenant_id, embedding_hash)
  where embedding_hash is not null;

alter table public.ce_intelligence_memories enable row level security;

create or replace function public.match_ce_intelligence_memories(
  p_tenant_id uuid,
  p_query_embedding extensions.vector(1536),
  p_domain text default null,
  p_match_count integer default 10
)
returns table (
  id uuid,
  memory_type text,
  title text,
  content text,
  domain text,
  confidence numeric,
  source text,
  source_ref text,
  observed_at timestamptz,
  created_at timestamptz,
  tags jsonb,
  metadata jsonb,
  relevance double precision
)
language sql
stable
as $$
  select
    m.id,m.memory_type,m.title,m.content,m.domain,m.confidence,m.source,m.source_ref,
    m.observed_at,m.created_at,m.tags,m.metadata,
    1 - (m.embedding <=> p_query_embedding) as relevance
  from public.ce_intelligence_memories m
  where m.tenant_id = p_tenant_id
    and m.status = 'ACTIVE'
    and m.embedding is not null
    and (p_domain is null or m.domain = p_domain)
  order by m.embedding <=> p_query_embedding
  limit greatest(1, least(coalesce(p_match_count,10),50));
$$;

revoke execute on function public.match_ce_intelligence_memories(uuid, extensions.vector(1536), text, integer) from public, anon, authenticated;
grant execute on function public.match_ce_intelligence_memories(uuid, extensions.vector(1536), text, integer) to service_role;
alter function public.match_ce_intelligence_memories(uuid, extensions.vector(1536), text, integer)
  set search_path = public, extensions;
