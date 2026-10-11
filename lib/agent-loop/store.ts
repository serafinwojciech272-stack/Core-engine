// Run persistence. Every save is an optimistic compare-and-swap on `version`, so two workers can
// never both advance the same run. Memory store: tests/dev. File store: single host, survives restarts.
// Supabase store: shared between web and worker services (ADR-001 phase 2).
import { mkdir, readFile, readdir, rename, rmdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TERMINAL_STATUSES, type AgentRun } from "@/lib/agent-loop/contracts";

export class VersionConflictError extends Error { constructor(id: string) { super("RUN_VERSION_CONFLICT:" + id); } }

export interface RunStore {
  create(run: AgentRun): Promise<void>;
  get(id: string): Promise<AgentRun | null>;
  /** Persists `run` only if the stored version equals run.version; returns the saved copy (version+1). */
  save(run: AgentRun): Promise<AgentRun>;
  /**
   * Claims one runnable run (QUEUED, or RUNNING with an expired lease) for `owner`, oldest first.
   * Only runs whose `requires` is covered by `capabilities` are eligible (ADR-003).
   */
  claimNext(owner: string, leaseMs: number, now?: number, capabilities?: readonly string[]): Promise<AgentRun | null>;
  list(tenantId: string, limit?: number): Promise<AgentRun[]>;
}

const clone = <T>(v: T): T => structuredClone(v);

export function canServe(run: AgentRun, capabilities: readonly string[] = []) {
  return (run.requires ?? []).every((c) => capabilities.includes(c));
}

function runnable(run: AgentRun, now: number, capabilities: readonly string[] = []) {
  if (!canServe(run, capabilities)) return false;
  if (run.status === "QUEUED") return true;
  return run.status === "RUNNING" && (!run.lease || run.lease.expiresAt <= now);
}

function stamp(run: AgentRun): AgentRun {
  return { ...clone(run), version: run.version + 1, updatedAt: new Date().toISOString() };
}

export class MemoryRunStore implements RunStore {
  private runs = new Map<string, AgentRun>();
  async create(run: AgentRun) { if (this.runs.has(run.id)) throw new Error("RUN_EXISTS"); this.runs.set(run.id, clone(run)); }
  async get(id: string) { const r = this.runs.get(id); return r ? clone(r) : null; }
  async save(run: AgentRun) {
    const current = this.runs.get(run.id);
    if (!current || current.version !== run.version) throw new VersionConflictError(run.id);
    const next = stamp(run); this.runs.set(run.id, next); return clone(next);
  }
  async claimNext(owner: string, leaseMs: number, now = Date.now(), capabilities: readonly string[] = []) {
    const candidate = [...this.runs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((r) => runnable(r, now, capabilities));
    if (!candidate) return null;
    return this.save({ ...clone(candidate), status: "RUNNING", lease: { owner, expiresAt: now + leaseMs } });
  }
  async list(tenantId: string, limit = 50) {
    return [...this.runs.values()].filter((r) => r.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(clone);
  }
}

export class FileRunStore implements RunStore {
  private readonly dir: string;
  constructor(dir: string) { this.dir = dir; }
  private file(id: string) { if (!/^[\w-]{8,64}$/.test(id)) throw new Error("INVALID_RUN_ID"); return join(this.dir, id + ".json"); }

  private async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    await mkdir(this.dir, { recursive: true });
    const lock = this.file(id) + ".lock";
    for (let i = 0; ; i++) {
      try { await mkdir(lock); break; } catch {
        try { const s = await stat(lock); if (Date.now() - s.mtimeMs > 10_000) { await rmdir(lock).catch(() => {}); continue; } } catch { continue; }
        if (i > 200) throw new Error("RUN_LOCK_TIMEOUT:" + id);
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    try { return await fn(); } finally { await rmdir(lock).catch(() => {}); }
  }

  private async read(id: string): Promise<AgentRun | null> {
    try { return JSON.parse(await readFile(this.file(id), "utf8")) as AgentRun; } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
  }

  private async write(run: AgentRun) {
    const tmp = this.file(run.id) + "." + process.pid + ".tmp";
    await writeFile(tmp, JSON.stringify(run));
    await rename(tmp, this.file(run.id));
  }

  async create(run: AgentRun) {
    await this.withLock(run.id, async () => { if (await this.read(run.id)) throw new Error("RUN_EXISTS"); await this.write(run); });
  }
  async get(id: string) { return this.read(id); }
  async save(run: AgentRun) {
    return this.withLock(run.id, async () => {
      const current = await this.read(run.id);
      if (!current || current.version !== run.version) throw new VersionConflictError(run.id);
      const next = stamp(run); await this.write(next); return next;
    });
  }
  private async all(): Promise<AgentRun[]> {
    await mkdir(this.dir, { recursive: true });
    const names = (await readdir(this.dir)).filter((n) => n.endsWith(".json"));
    const runs = await Promise.all(names.map((n) => this.read(n.slice(0, -5))));
    return runs.filter((r): r is AgentRun => Boolean(r));
  }
  async claimNext(owner: string, leaseMs: number, now = Date.now(), capabilities: readonly string[] = []) {
    const candidates = (await this.all()).filter((r) => runnable(r, now, capabilities)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const c of candidates) {
      try { return await this.save({ ...c, status: "RUNNING", lease: { owner, expiresAt: now + leaseMs } }); } catch (e) { if (!(e instanceof VersionConflictError)) throw e; }
    }
    return null;
  }
  async list(tenantId: string, limit = 50) {
    return (await this.all()).filter((r) => r.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
}

export function isTerminal(run: AgentRun) { return TERMINAL_STATUSES.includes(run.status); }

type SupabaseConfig = { url: string; key: string; fetchImpl?: typeof fetch; timeoutMs?: number; restPath?: string };

/**
 * Supabase/PostgREST store (ADR-001 phase 2). Table `ce_agent_jobs`, migration 20261010090000.
 * save() is a conditional PATCH on (id, version) — an empty result means another writer won (CAS).
 * claimNext() uses the `ce_agent_job_claim_v2` RPC (FOR UPDATE SKIP LOCKED + capability filter, migration
 * 20261011090000) so many workers can poll safely. Until that migration is applied it falls back to the v1 RPC
 * and hands back runs this worker cannot serve.
 */
export class SupabaseRunStore implements RunStore {
  private readonly base: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private legacyClaim = false;
  constructor(config: SupabaseConfig) {
    // Accept both "https://x.supabase.co" and the "…/rest/v1/" form shown in some Supabase screens.
    const origin = config.url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
    this.base = origin + (config.restPath ?? "/rest/v1");
    this.key = config.key;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  private async req(path: string, init: RequestInit & { prefer?: string } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.base + path, {
        ...init, signal: controller.signal, cache: "no-store",
        headers: { apikey: this.key, authorization: "Bearer " + this.key, "content-type": "application/json", ...(init.prefer ? { prefer: init.prefer } : {}) },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`RUN_STORE_HTTP_${res.status}:${text.slice(0, 200)}`);
      return text ? JSON.parse(text) : null;
    } finally { clearTimeout(timer); }
  }

  private columns(run: AgentRun) {
    return {
      id: run.id, tenant_id: run.tenantId, status: run.status, version: run.version,
      lease_owner: run.lease?.owner ?? null,
      lease_expires_at: run.lease ? new Date(run.lease.expiresAt).toISOString() : null,
      data: run, updated_at: run.updatedAt,
      // Sent only when set, so runs without requirements still work before migration 20261011090000.
      ...(run.requires?.length ? { requires: run.requires } : {}),
    };
  }

  async create(run: AgentRun) {
    try {
      await this.req("/ce_agent_jobs", { method: "POST", body: JSON.stringify({ ...this.columns(run), created_at: run.createdAt }), prefer: "return=minimal" });
    } catch (error) {
      if (String(error).includes("RUN_STORE_HTTP_409")) throw new Error("RUN_EXISTS");
      throw error;
    }
  }

  async get(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const rows = await this.req(`/ce_agent_jobs?id=eq.${id}&select=data`) as Array<{ data: AgentRun }>;
    return rows[0]?.data ?? null;
  }

  async save(run: AgentRun) {
    const next = stamp(run);
    const rows = await this.req(`/ce_agent_jobs?id=eq.${run.id}&version=eq.${run.version}`, {
      method: "PATCH", body: JSON.stringify(this.columns(next)), prefer: "return=representation",
    }) as Array<{ data: AgentRun }>;
    if (!rows.length) throw new VersionConflictError(run.id);
    return rows[0].data;
  }

  async claimNext(owner: string, leaseMs: number, _now?: number, capabilities: readonly string[] = []) {
    const lease = Math.max(1, Math.ceil(leaseMs / 1000));
    if (!this.legacyClaim) {
      try {
        const rows = await this.req("/rpc/ce_agent_job_claim_v2", { method: "POST", body: JSON.stringify({ p_owner: owner, p_lease_seconds: lease, p_capabilities: [...capabilities] }) }) as Array<{ data: AgentRun }>;
        return rows?.[0]?.data ?? null;
      } catch (error) {
        if (!/RUN_STORE_HTTP_404:.*PGRST202/.test(String(error))) throw error;
        this.legacyClaim = true;
        console.warn("[agent-loop] ce_agent_job_claim_v2 missing — apply migration 20261011090000; using v1 claim");
      }
    }
    const rows = await this.req("/rpc/ce_agent_job_claim", { method: "POST", body: JSON.stringify({ p_owner: owner, p_lease_seconds: lease }) }) as Array<{ data: AgentRun }>;
    const run = rows?.[0]?.data ?? null;
    if (run && !canServe(run, capabilities)) {
      // v1 cannot filter: hand the run back so a capable worker gets it, and stop draining this cycle.
      await this.save({ ...run, status: "QUEUED", lease: undefined }).catch(() => {});
      return null;
    }
    return run;
  }

  async list(tenantId: string, limit = 50) {
    const rows = await this.req(`/ce_agent_jobs?tenant_id=eq.${encodeURIComponent(tenantId)}&select=data&order=created_at.desc&limit=${Math.min(Math.max(1, limit), 200)}`) as Array<{ data: AgentRun }>;
    return rows.map((r) => r.data);
  }
}

let shared: RunStore | null = null;
/**
 * Process-wide store. AGENT_RUN_STORE=memory|file|supabase; default: supabase when SUPABASE_URL and a
 * server key are configured (required when web and worker run as separate services), otherwise file.
 */
export function runStoreKind(): "memory" | "file" | "supabase" {
  const configured = Boolean(process.env.SUPABASE_URL?.trim() && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim());
  const kind = process.env.AGENT_RUN_STORE || (configured ? "supabase" : "file");
  return kind === "supabase" || kind === "memory" ? kind : "file";
}

export function getRunStore(): RunStore {
  if (shared) return shared;
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const kind = process.env.AGENT_RUN_STORE || (url && key ? "supabase" : "file");
  if (kind === "supabase") {
    if (!url || !key) throw new Error("AGENT_RUN_STORE_SUPABASE_NOT_CONFIGURED");
    shared = new SupabaseRunStore({ url, key });
  } else {
    shared = kind === "memory" ? new MemoryRunStore() : new FileRunStore(process.env.AGENT_RUN_DIR || join(process.cwd(), ".agent-runs"));
  }
  return shared;
}
