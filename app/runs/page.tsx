"use client";

// NEXORA Mission Control — operator panel for durable agent runs (ADR-001, ADR-003).
// Start runs from playbooks or a free-form goal, watch progress against budget, approve side effects,
// inspect workspace files and download artifacts. Talks only to /api/agent/* with the operator's API key.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./runs.module.css";

type Step = { index: number; kind: string; summary: string; toolName?: string; toolStatus?: string; completedAt: string; usage?: { costUsd: number }; error?: string };
type Artifact = { id: string; name: string; type: string; mimeType: string | null; size: number };
type Usage = { steps: number; promptTokens: number; completionTokens: number; costUsd: number; activeMs: number };
type Run = {
  id: string; status: string; goal: string; context: string | null; acceptanceCriteria: string[]; error: string | null;
  requires: string[]; playbookId: string | null;
  budget: { maxSteps: number; maxCostUsd: number; maxWallMs: number };
  usage: Usage;
  pendingApproval: { toolName: string; arguments: Record<string, unknown>; reason: string } | null;
  result: { summary: string; criteria: Array<{ criterion: string; met: boolean; evidence: string }> } | null;
  progress: { plan: string | null };
  steps: Step[]; artifacts: Artifact[]; workspace: Record<string, { bytes: number }>;
  workspaceFiles?: Record<string, string>;
  createdAt: string; updatedAt: string;
};
type RunSummary = { id: string; status: string; goal: string; usage: Usage; playbookId: string | null; requires: string[]; createdAt: string; updatedAt: string };
type PlaybookField = { key: string; label: string; placeholder: string; multiline?: boolean; required?: boolean; maxLength?: number };
type Playbook = { id: string; title: string; tagline: string; category: string; glyph: string; inputs: PlaybookField[]; budget: { maxCostUsd?: number; maxSteps?: number }; sandbox: "optional" | null };
type Status = {
  llm: { configured: boolean; provider: string | null; model: string | null; issue: string | null };
  store: { kind: string; durable: boolean };
  worker: { mode: string; sandbox: boolean };
  limits: { maxCostUsdPerRun: number | null };
};

const KEY_STORAGE = "core-engine-operator-key";
const ACTIVE = ["QUEUED", "RUNNING"];
const FAILED = ["FAILED", "BUDGET_EXHAUSTED", "CANCELLED"];
const STATUS_LABEL: Record<string, string> = { QUEUED: "W kolejce", RUNNING: "Pracuje", WAITING_APPROVAL: "Czeka na Ciebie", COMPLETED: "Gotowe", FAILED: "Błąd", BUDGET_EXHAUSTED: "Budżet wyczerpany", CANCELLED: "Anulowany" };
const CATEGORY_LABEL: Record<string, string> = { build: "Budowa", strategy: "Strategia", growth: "Wzrost", data: "Dane" };
type Filter = "all" | "active" | "done" | "failed";

function storageGet() { try { return sessionStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; } }
function storageSet(v: string) { try { if (v) sessionStorage.setItem(KEY_STORAGE, v); else sessionStorage.removeItem(KEY_STORAGE); } catch { /* private mode */ } }
const usd = (n: number) => "$" + n.toFixed(n < 0.1 ? 4 : 2);
const secs = (ms: number) => (ms < 60_000 ? (ms / 1000).toFixed(ms < 10_000 ? 1 : 0) + " s" : Math.round(ms / 60_000) + " min");
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "przed chwilą";
  if (s < 3600) return Math.floor(s / 60) + " min temu";
  if (s < 86_400) return Math.floor(s / 3600) + " h temu";
  return new Date(iso).toLocaleDateString("pl-PL");
}

/** Turns raw engine errors into something an operator can act on. */
function explainError(error: string): string | null {
  if (/AUTH_REQUIRED/.test(error)) return "Klucz operatora został odrzucony. Zaloguj się ponownie kluczem CORE_ENGINE_API_KEY z Render.";
  if (/not a valid model ID|LLM_CONFIG|AGENT_LLM_NOT_CONFIGURED/.test(error)) return "Model AI jest źle skonfigurowany (sprawdź ANTHROPIC_API_KEY i AGENT_LLM_MODEL w Render).";
  if (/PGRST205|PGRST202/.test(error)) return "W Supabase brakuje tabeli lub funkcji agenta — uruchom migracje z folderu supabase/migrations.";
  if (/PGRST125/.test(error)) return "SUPABASE_URL ma zły format — zostaw sam adres https://…supabase.co.";
  if (/LLM_HTTP_429/.test(error)) return "Limit zapytań do modelu — odczekaj chwilę i wznów run.";
  if (/LLM_HTTP_40[13]/.test(error)) return "Klucz API modelu jest nieprawidłowy albo bez środków.";
  if (/MAX_COST|MAX_STEPS|MAX_TOKENS|MAX_WALL_TIME/.test(error)) return "Run doszedł do limitu budżetu. Możesz go wznowić z dodatkowym budżetem.";
  return null;
}

function Meter({ label, value, max, format }: { label: string; value: number; max: number; format: (n: number) => string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={styles.meter} data-level={pct >= 90 ? "high" : pct >= 60 ? "mid" : "low"}>
      <div className={styles.meterHead}><span>{label}</span><strong>{format(value)} <small>/ {format(max)}</small></strong></div>
      <div className={styles.meterTrack} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: pct + "%" }} /></div>
    </div>
  );
}

export default function RunsPage() {
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [loginError, setLoginError] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"playbook" | "custom">("playbook");
  const [playbookId, setPlaybookId] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [useSandbox, setUseSandbox] = useState(false);
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [criteria, setCriteria] = useState("");
  const [maxCost, setMaxCost] = useState("1");
  const [maxSteps, setMaxSteps] = useState("40");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [allSteps, setAllSteps] = useState(false);
  const poller = useRef<number | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  const logout = useCallback((reason = "") => {
    storageSet(""); setApiKey(""); setKeyDraft(""); setRuns([]); setSelected(null); setRun(null); setStatus(null); setLoginError(reason);
  }, []);

  // Deferred so the prerendered HTML and the first client render match (storage is client-only).
  useEffect(() => { const t = window.setTimeout(() => { const k = storageGet(); setApiKey(k); setKeyDraft(k); }, 0); return () => window.clearTimeout(t); }, []);

  const api = useCallback(async (path: string, init: RequestInit = {}, key = apiKey) => {
    const res = await fetch(path, { ...init, cache: "no-store", headers: { "content-type": "application/json", authorization: "Bearer " + key, ...(init.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) { logout("Klucz odrzucony przez serwer. Sprawdź CORE_ENGINE_API_KEY w Render."); throw new Error("AUTH_REQUIRED"); }
    if (!res.ok || body.ok === false) throw new Error([body.error || "HTTP " + res.status, body.detail].filter(Boolean).join(": "));
    return body;
  }, [apiKey, logout]);

  const fail = useCallback((e: unknown) => { const m = (e as Error).message; if (m !== "AUTH_REQUIRED") setError(m); }, []);

  const loadList = useCallback(async () => {
    if (!apiKey) return;
    try { setRuns((await api("/api/agent/runs")).runs); } catch (e) { fail(e); }
  }, [api, apiKey, fail]);

  const loadRun = useCallback(async (id: string) => {
    try { setRun((await api(`/api/agent/runs/${id}?messages=1`)).run); } catch (e) { fail(e); }
  }, [api, fail]);

  // Initial load: system status, playbooks, history.
  useEffect(() => {
    if (!apiKey) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const [s, p] = await Promise.all([api("/api/agent/status"), api("/api/agent/playbooks")]);
          setStatus(s); setPlaybooks(p.playbooks);
          if (s.limits?.maxCostUsdPerRun) setMaxCost((c) => String(Math.min(Number(c) || 1, s.limits.maxCostUsdPerRun)));
        } catch (e) { fail(e); }
        await loadList();
      })();
    }, 0);
    return () => window.clearTimeout(t);
  }, [apiKey, api, fail, loadList]);

  function select(id: string) {
    setSelected(id); setOpenFile(null); setError(""); setGoalOpen(false); setAllSteps(false); void loadRun(id);
    // Single-column layout: bring the detail into view instead of leaving the operator at the list.
    if (window.matchMedia("(max-width: 920px)").matches) window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  // Poll the selected run while it is active (and the list, so statuses stay fresh).
  useEffect(() => {
    if (poller.current) window.clearInterval(poller.current);
    if (!selected || !run || !ACTIVE.includes(run.status)) return;
    poller.current = window.setInterval(() => { void loadRun(selected); void loadList(); }, 2500);
    return () => { if (poller.current) window.clearInterval(poller.current); };
  }, [selected, run, loadRun, loadList]);

  // When the selected run settles, refresh the list once so its badge matches the detail view.
  const settledStatus = run && !ACTIVE.includes(run.status) ? run.status : null;
  useEffect(() => {
    if (!settledStatus) return;
    const t = window.setTimeout(() => { void loadList(); }, 0);
    return () => window.clearTimeout(t);
  }, [settledStatus, loadList]);

  const playbook = playbooks.find((p) => p.id === playbookId) ?? null;

  function pickPlaybook(p: Playbook) {
    setPlaybookId(p.id); setInputs({}); setUseSandbox(false);
    if (p.budget.maxCostUsd) setMaxCost(String(Math.min(p.budget.maxCostUsd, status?.limits.maxCostUsdPerRun ?? p.budget.maxCostUsd)));
    if (p.budget.maxSteps) setMaxSteps(String(p.budget.maxSteps));
  }

  const canSubmit = mode === "custom" ? Boolean(goal.trim()) : Boolean(playbook && playbook.inputs.every((f) => !f.required || inputs[f.key]?.trim()));

  async function createRun(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true); setError("");
    const budget = { maxCostUsd: Number(maxCost) || 1, maxSteps: Number(maxSteps) || 40 };
    try {
      const payload = mode === "playbook" && playbook
        ? { playbookId: playbook.id, inputs, sandbox: useSandbox, budget }
        : { goal, context: context.trim() || undefined, acceptanceCriteria: criteria.split("\n").map((c) => c.trim()).filter(Boolean), budget };
      const body = await api("/api/agent/runs", { method: "POST", body: JSON.stringify(payload) });
      if (mode === "custom") { setGoal(""); setCriteria(""); setContext(""); } else setInputs({});
      setNotice("Run uruchomiony"); window.setTimeout(() => setNotice(""), 2500);
      select(body.run.id);
      await loadList();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  function onFormKey(e: React.KeyboardEvent) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void createRun(); } }

  async function action(name: "approve" | "reject" | "cancel" | "resume") {
    if (!run) return;
    setBusy(true);
    try {
      await api(`/api/agent/runs/${run.id}`, { method: "POST", body: JSON.stringify({ action: name, ...(name === "resume" ? { budget: { maxSteps: 20, maxCostUsd: 1 } } : {}) }) });
      await loadRun(run.id); await loadList();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  function duplicate() {
    if (!run) return;
    setMode("custom"); setGoal(run.goal); setContext(run.context ?? ""); setCriteria(run.acceptanceCriteria.join("\n"));
    setMaxCost(String(run.budget.maxCostUsd)); setMaxSteps(String(run.budget.maxSteps));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function save(name: string, href: string) { const link = document.createElement("a"); link.href = href; link.download = name; link.click(); }

  async function download(a: Artifact) {
    if (!run) return;
    try {
      const { artifact } = await api(`/api/agent/runs/${run.id}?artifact=${a.id}`);
      save(a.name || "artifact", artifact.dataUrl || URL.createObjectURL(new Blob([artifact.content || ""], { type: artifact.type === "website" ? "text/html" : "text/plain" })));
    } catch (err) { fail(err); }
  }

  async function copyFile(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Skopiowano"); window.setTimeout(() => setNotice(""), 1500); } catch { setError("Nie udało się skopiować"); }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const key = keyDraft.trim();
    if (!key) return;
    setBusy(true); setLoginError("");
    try {
      const res = await fetch("/api/agent/status", { cache: "no-store", headers: { authorization: "Bearer " + key } });
      if (res.status === 401) { setLoginError("Ten klucz nie pasuje. Skopiuj CORE_ENGINE_API_KEY z Render (bez spacji)."); return; }
      storageSet(key); setApiKey(key);
    } catch { setLoginError("Serwer nie odpowiada — usługa mogła zasnąć, spróbuj za kilkanaście sekund."); } finally { setBusy(false); }
  }

  const visibleRuns = useMemo(() => runs.filter((r) => {
    if (filter === "active" && !(ACTIVE.includes(r.status) || r.status === "WAITING_APPROVAL")) return false;
    if (filter === "done" && r.status !== "COMPLETED") return false;
    if (filter === "failed" && !FAILED.includes(r.status)) return false;
    return !query.trim() || r.goal.toLowerCase().includes(query.trim().toLowerCase());
  }), [runs, filter, query]);

  const counts = useMemo(() => ({
    active: runs.filter((r) => ACTIVE.includes(r.status) || r.status === "WAITING_APPROVAL").length,
    spent: runs.reduce((s, r) => s + r.usage.costUsd, 0),
  }), [runs]);

  if (!apiKey) {
    return (
      <main className={styles.page}>
        <form className={styles.keyCard} onSubmit={login}>
          <div className={styles.brandMark} aria-hidden>N</div>
          <h1>NEXORA Mission Control</h1>
          <p>Panel operatora agentów AI. Podaj klucz <code>CORE_ENGINE_API_KEY</code> — zostaje tylko w tej karcie przeglądarki.</p>
          <input type="password" autoComplete="off" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="klucz operatora" aria-label="Klucz operatora" autoFocus />
          {loginError && <p className={styles.errorText} role="alert">{loginError}</p>}
          <button type="submit" disabled={!keyDraft.trim() || busy}>{busy ? "Sprawdzam…" : "Wejdź"}</button>
        </form>
      </main>
    );
  }

  const waitingForSandbox = run && run.status === "QUEUED" && run.requires.includes("sandbox") && !status?.worker.sandbox;
  const hint = run?.error ? explainError(run.error) : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandMark} aria-hidden>N</div>
          <div>
            <Link href="/runtime" className={styles.back}>← Runtime</Link>
            <h1>Mission Control</h1>
          </div>
        </div>
        <div className={styles.chips} aria-label="Stan systemu">
          {status && <>
            <span className={styles.chip} data-tone={status.llm.configured ? "ok" : "bad"} title={status.llm.issue ?? ""}>Model · {status.llm.model ?? "brak"}</span>
            <span className={styles.chip} data-tone={status.store.durable ? "ok" : "warn"}>Pamięć · {status.store.kind === "supabase" ? "Supabase" : status.store.kind === "file" ? "dysk (tymczasowa)" : "RAM"}</span>
            <span className={styles.chip} data-tone={status.worker.sandbox ? "ok" : "muted"}>Sandbox · {status.worker.sandbox ? "tak" : "lokalny worker"}</span>
          </>}
          <span className={styles.chip} data-tone="muted">Aktywne {counts.active} · wydane {usd(counts.spent)}</span>
          <button className={styles.ghost} onClick={() => logout()}>Wyloguj</button>
        </div>
      </header>
      {status?.llm.issue && <div className={styles.error} role="alert">Konfiguracja modelu: {status.llm.issue}</div>}
      {error && <div className={styles.error} role="alert"><span>{explainError(error) ?? error}</span><button className={styles.close} onClick={() => setError("")} aria-label="Zamknij">×</button></div>}
      {notice && <div className={styles.toast} role="status">{notice}</div>}

      <div className={styles.grid}>
        <aside className={styles.side}>
          <form className={styles.card} onSubmit={createRun} onKeyDown={onFormKey}>
            <div className={styles.tabs} role="tablist">
              <button type="button" role="tab" aria-selected={mode === "playbook"} className={mode === "playbook" ? styles.tabOn : styles.tab} onClick={() => setMode("playbook")}>Playbooki</button>
              <button type="button" role="tab" aria-selected={mode === "custom"} className={mode === "custom" ? styles.tabOn : styles.tab} onClick={() => setMode("custom")}>Własny cel</button>
            </div>

            {mode === "playbook" && !playbook && (
              <div className={styles.gallery}>
                {playbooks.map((p) => (
                  <button type="button" key={p.id} className={styles.pb} onClick={() => pickPlaybook(p)}>
                    <span className={styles.glyph} data-cat={p.category}>{p.glyph}</span>
                    <span className={styles.pbTitle}>{p.title}</span>
                    <span className={styles.pbTag}>{p.tagline}</span>
                    <span className={styles.pbMeta}>{CATEGORY_LABEL[p.category] ?? p.category}{p.budget.maxCostUsd ? ` · do ${usd(p.budget.maxCostUsd)}` : ""}</span>
                  </button>
                ))}
                {!playbooks.length && <p className={styles.muted}>Ładuję playbooki…</p>}
              </div>
            )}

            {mode === "playbook" && playbook && (
              <>
                <div className={styles.pbHeader}>
                  <span className={styles.glyph} data-cat={playbook.category}>{playbook.glyph}</span>
                  <div><strong>{playbook.title}</strong><p className={styles.muted}>{playbook.tagline}</p></div>
                  <button type="button" className={styles.link} onClick={() => setPlaybookId(null)}>zmień</button>
                </div>
                {playbook.inputs.map((f) => (
                  <label key={f.key}>{f.label}{f.required ? " *" : ""}
                    {f.multiline
                      ? <textarea rows={f.key === "data" ? 8 : 4} value={inputs[f.key] ?? ""} maxLength={f.maxLength} onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })} placeholder={f.placeholder} />
                      : <input value={inputs[f.key] ?? ""} maxLength={f.maxLength} onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })} placeholder={f.placeholder} />}
                  </label>
                ))}
                {playbook.sandbox && (
                  <label className={styles.check}>
                    <input type="checkbox" checked={useSandbox} onChange={(e) => setUseSandbox(e.target.checked)} />
                    <span>Uruchamiaj kod i testy <small>{status?.worker.sandbox ? "(sandbox dostępny)" : "(czeka na lokalny worker: npm run agent:worker:local)"}</small></span>
                  </label>
                )}
              </>
            )}

            {mode === "custom" && (
              <>
                <label>Cel<textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={5} placeholder="Np. Zbuduj moduł faktur z testami i opisz, jak go wdrożyć." /></label>
                <label>Kryteria akceptacji <small>(jedno na linię)</small><textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={3} placeholder={"Moduł invoice.py\nMin. 5 testów\nREADME z przykładem"} /></label>
                <details className={styles.more} open={Boolean(context)}>
                  <summary>Kontekst / dane</summary>
                  <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={4} placeholder="Wklej dane, notatki, specyfikację…" />
                </details>
              </>
            )}

            {(mode === "custom" || playbook) && (
              <>
                <div className={styles.row}>
                  <label>Budżet USD<input type="number" min="0.05" step="0.05" max={status?.limits.maxCostUsdPerRun ?? undefined} value={maxCost} onChange={(e) => setMaxCost(e.target.value)} /></label>
                  <label>Max kroków<input type="number" min="1" max="200" value={maxSteps} onChange={(e) => setMaxSteps(e.target.value)} /></label>
                </div>
                <button type="submit" className={styles.primary} disabled={busy || !canSubmit}>{busy ? "Uruchamiam…" : "Uruchom agenta"} <kbd>Ctrl ↵</kbd></button>
              </>
            )}
          </form>

          <div className={styles.card}>
            <div className={styles.cardHead}><h2>Historia</h2><span className={styles.muted}>{runs.length}</span></div>
            <div className={styles.filters}>
              {(["all", "active", "done", "failed"] as Filter[]).map((f) => (
                <button key={f} type="button" className={filter === f ? styles.filterOn : styles.filter} onClick={() => setFilter(f)}>{{ all: "Wszystkie", active: "Aktywne", done: "Gotowe", failed: "Błędy" }[f]}</button>
              ))}
            </div>
            <input className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj w celach…" aria-label="Szukaj" />
            {!visibleRuns.length && <p className={styles.muted}>{runs.length ? "Nic nie pasuje do filtra." : "Brak runów — zacznij od playbooka powyżej."}</p>}
            <ul className={styles.list}>
              {visibleRuns.map((r) => (
                <li key={r.id}>
                  <button className={r.id === selected ? styles.active : ""} onClick={() => select(r.id)}>
                    <span className={styles.listTop}>
                      <span className={styles.badge} data-status={r.status}>{STATUS_LABEL[r.status] ?? r.status}</span>
                      {r.playbookId && <span className={styles.tag}>{playbooks.find((p) => p.id === r.playbookId)?.title ?? r.playbookId}</span>}
                      {r.requires.includes("sandbox") && <span className={styles.tag}>sandbox</span>}
                    </span>
                    <span className={styles.goal}>{r.goal}</span>
                    <span className={styles.muted}>{usd(r.usage.costUsd)} · {r.usage.steps} kroków · {ago(r.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className={styles.detail} ref={detailRef}>
          {!run && (
            <div className={`${styles.card} ${styles.welcome}`}>
              <h2>Gotowy do pracy</h2>
              <ol>
                <li><strong>Wybierz playbook</strong> — np. „Projekt agenta AI” albo „CEO: plan wykonawczy” — i wypełnij 2–3 pola.</li>
                <li><strong>Obserwuj</strong> — agent planuje, zapisuje pliki i pilnuje budżetu. Możesz zamknąć kartę, run działa dalej.</li>
                <li><strong>Akceptuj</strong> — wysyłki i inne akcje na zewnątrz zawsze czekają na Twoje „Zatwierdź”.</li>
              </ol>
            </div>
          )}
          {run && (
            <>
              <div className={styles.card}>
                <div className={styles.titleRow}>
                  <span className={styles.badge} data-status={run.status}>{STATUS_LABEL[run.status] ?? run.status}</span>
                  {ACTIVE.includes(run.status) && <span className={styles.pulse} aria-label="w toku" />}
                  <span className={styles.muted}>{ago(run.createdAt)}</span>
                  <div className={styles.actions}>
                    <button className={styles.ghost} onClick={duplicate} title="Skopiuj cel do formularza">Duplikuj</button>
                    {ACTIVE.includes(run.status) || run.status === "WAITING_APPROVAL" ? <button className={styles.ghost} disabled={busy} onClick={() => action("cancel")}>Anuluj</button> : null}
                    {["BUDGET_EXHAUSTED", "FAILED"].includes(run.status) && <button className={styles.primary} disabled={busy} onClick={() => action("resume")}>Wznów (+20 kroków, +$1)</button>}
                  </div>
                </div>
                <p className={styles.goalFull} data-open={goalOpen || run.goal.length < 280}>{run.goal}</p>
                {run.goal.length >= 280 && <button type="button" className={styles.link} onClick={() => setGoalOpen(!goalOpen)}>{goalOpen ? "zwiń" : "pokaż cały cel"}</button>}
                {waitingForSandbox && <p className={styles.info}>Ten run wymaga uruchamiania kodu. Czeka na lokalny worker z sandboxem: <code>npm run agent:worker:local</code></p>}
                <div className={styles.meters}>
                  <Meter label="Kroki" value={run.usage.steps} max={run.budget.maxSteps} format={(n) => String(n)} />
                  <Meter label="Koszt" value={run.usage.costUsd} max={run.budget.maxCostUsd} format={usd} />
                  <Meter label="Czas" value={run.usage.activeMs} max={run.budget.maxWallMs} format={secs} />
                </div>
                <p className={styles.muted}>Tokeny: {(run.usage.promptTokens + run.usage.completionTokens).toLocaleString("pl-PL")}</p>
                {run.error && <div className={styles.errorBox}><strong>{hint ?? "Błąd"}</strong><code>{run.error}</code></div>}
              </div>

              {run.pendingApproval && (
                <div className={`${styles.card} ${styles.approval}`}>
                  <h2>Wymaga Twojej akceptacji: {run.pendingApproval.toolName}</h2>
                  <p className={styles.muted}>{run.pendingApproval.reason}</p>
                  <pre>{JSON.stringify(run.pendingApproval.arguments, null, 2)}</pre>
                  <div className={styles.row}>
                    <button className={styles.primary} disabled={busy} onClick={() => action("approve")}>Zatwierdź</button>
                    <button className={styles.danger} disabled={busy} onClick={() => action("reject")}>Odrzuć</button>
                  </div>
                </div>
              )}

              {run.result && (
                <div className={`${styles.card} ${styles.resultCard}`}>
                  <h2>Wynik</h2>
                  <p className={styles.pre}>{run.result.summary}</p>
                  {run.result.criteria.length > 0 && (
                    <ul className={styles.criteria}>
                      {run.result.criteria.map((c) => <li key={c.criterion} data-met={c.met}><strong>{c.met ? "✓" : "✗"} {c.criterion}</strong><span>{c.evidence}</span></li>)}
                    </ul>
                  )}
                </div>
              )}

              {run.artifacts.length > 0 && (
                <div className={styles.card}>
                  <h2>Artefakty</h2>
                  <ul className={styles.files}>
                    {run.artifacts.map((a) => <li key={a.id}><button onClick={() => download(a)}>⬇ {a.name} <span className={styles.muted}>{a.type}</span></button></li>)}
                  </ul>
                </div>
              )}

              {Object.keys(run.workspace).length > 0 && (
                <div className={styles.card}>
                  <div className={styles.cardHead}><h2>Pliki agenta</h2><span className={styles.muted}>{Object.keys(run.workspace).length}</span></div>
                  <ul className={styles.files}>
                    {Object.entries(run.workspace).map(([path, meta]) => (
                      <li key={path}><button className={openFile === path ? styles.active : ""} onClick={() => setOpenFile(openFile === path ? null : path)}>{path} <span className={styles.muted}>{meta.bytes.toLocaleString("pl-PL")} B</span></button></li>
                    ))}
                  </ul>
                  {openFile && run.workspaceFiles?.[openFile] !== undefined && (
                    <div className={styles.viewer}>
                      <div className={styles.viewerBar}>
                        <span>{openFile}</span>
                        <button type="button" className={styles.ghost} onClick={() => copyFile(run.workspaceFiles![openFile])}>Kopiuj</button>
                        <button type="button" className={styles.ghost} onClick={() => save(openFile.split("/").pop() || "file.txt", URL.createObjectURL(new Blob([run.workspaceFiles![openFile]], { type: "text/plain" })))}>Pobierz</button>
                      </div>
                      <pre className={styles.code}>{run.workspaceFiles[openFile]}</pre>
                    </div>
                  )}
                </div>
              )}

              {run.progress.plan && !run.workspace["PLAN.md"] && <div className={styles.card}><h2>Plan</h2><pre>{run.progress.plan}</pre></div>}

              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <h2>Przebieg ({run.steps.length})</h2>
                  {run.steps.length > 8 && <button type="button" className={styles.link} onClick={() => setAllSteps(!allSteps)}>{allSteps ? "ostatnie 8" : "pokaż wszystkie"}</button>}
                </div>
                <ol className={styles.timeline}>
                  {(allSteps ? run.steps : run.steps.slice(-8)).map((s) => (
                    <li key={s.index} data-kind={s.kind} data-status={s.toolStatus || ""}>
                      <span className={styles.dot} aria-hidden />
                      <div>
                        <span className={styles.stepKind}>{s.toolName ?? s.kind}{s.usage ? ` · ${usd(s.usage.costUsd)}` : ""}</span>
                        <span>{s.summary}</span>
                        {s.error && <span className={styles.errorText}>{s.error}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
