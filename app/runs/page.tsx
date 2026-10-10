"use client";

// Operator panel for durable agent runs (ADR-001): start a run, watch progress, approve side effects,
// inspect workspace files and download artifacts. Talks only to /api/agent/runs with the operator's API key.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./runs.module.css";

type Step = { index: number; kind: string; summary: string; toolName?: string; toolStatus?: string; completedAt: string; usage?: { costUsd: number }; error?: string };
type Artifact = { id: string; name: string; type: string; mimeType: string | null; size: number };
type Run = {
  id: string; status: string; goal: string; acceptanceCriteria: string[]; error: string | null;
  budget: { maxSteps: number; maxCostUsd: number; maxWallMs: number };
  usage: { steps: number; promptTokens: number; completionTokens: number; costUsd: number; activeMs: number };
  pendingApproval: { toolName: string; arguments: Record<string, unknown>; reason: string } | null;
  result: { summary: string; criteria: Array<{ criterion: string; met: boolean; evidence: string }> } | null;
  progress: { plan: string | null };
  steps: Step[]; artifacts: Artifact[]; workspace: Record<string, { bytes: number }>;
  workspaceFiles?: Record<string, string>;
  createdAt: string; updatedAt: string;
};
type RunSummary = { id: string; status: string; goal: string; usage: Run["usage"]; updatedAt: string };

const KEY_STORAGE = "core-engine-operator-key";
const ACTIVE = ["QUEUED", "RUNNING"];

function storageGet() { try { return sessionStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; } }
function storageSet(v: string) { try { if (v) sessionStorage.setItem(KEY_STORAGE, v); else sessionStorage.removeItem(KEY_STORAGE); } catch { /* private mode */ } }
const usd = (n: number) => "$" + n.toFixed(n < 0.1 ? 4 : 2);
const secs = (ms: number) => (ms / 1000).toFixed(ms < 10_000 ? 1 : 0) + " s";

export default function RunsPage() {
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState("");
  const [criteria, setCriteria] = useState("");
  const [maxCost, setMaxCost] = useState("1");
  const [maxSteps, setMaxSteps] = useState("40");
  const poller = useRef<number | null>(null);

  // Deferred so the prerendered HTML and the first client render match (storage is client-only).
  useEffect(() => { const t = window.setTimeout(() => { const k = storageGet(); setApiKey(k); setKeyDraft(k); }, 0); return () => window.clearTimeout(t); }, []);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const res = await fetch(path, { ...init, cache: "no-store", headers: { "content-type": "application/json", authorization: "Bearer " + apiKey, ...(init.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || "HTTP " + res.status);
    return body;
  }, [apiKey]);

  const loadList = useCallback(async () => {
    if (!apiKey) return;
    try { setRuns((await api("/api/agent/runs")).runs); setError(""); } catch (e) { setError((e as Error).message); }
  }, [api, apiKey]);

  const loadRun = useCallback(async (id: string) => {
    try { setRun((await api(`/api/agent/runs/${id}?messages=1`)).run); setError(""); } catch (e) { setError((e as Error).message); }
  }, [api]);

  useEffect(() => { const t = window.setTimeout(() => { void loadList(); }, 0); return () => window.clearTimeout(t); }, [loadList]);

  function select(id: string) { setSelected(id); setOpenFile(null); void loadRun(id); }

  // Poll the selected run while it is active (and the list, so statuses stay fresh).
  useEffect(() => {
    if (poller.current) window.clearInterval(poller.current);
    if (!selected || !run || !ACTIVE.includes(run.status)) return;
    poller.current = window.setInterval(() => { void loadRun(selected); void loadList(); }, 2500);
    return () => { if (poller.current) window.clearInterval(poller.current); };
  }, [selected, run, loadRun, loadList]);

  async function createRun(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    setBusy(true);
    try {
      const body = await api("/api/agent/runs", { method: "POST", body: JSON.stringify({
        goal, acceptanceCriteria: criteria.split("\n").map((c) => c.trim()).filter(Boolean),
        budget: { maxCostUsd: Number(maxCost) || 1, maxSteps: Number(maxSteps) || 40 },
      }) });
      setGoal(""); setCriteria("");
      select(body.run.id);
      await loadList();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function action(name: "approve" | "reject" | "cancel" | "resume") {
    if (!run) return;
    setBusy(true);
    try {
      await api(`/api/agent/runs/${run.id}`, { method: "POST", body: JSON.stringify({ action: name, ...(name === "resume" ? { budget: { maxSteps: 20, maxCostUsd: 1 } } : {}) }) });
      await loadRun(run.id); await loadList();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function download(a: Artifact) {
    if (!run) return;
    try {
      const { artifact } = await api(`/api/agent/runs/${run.id}?artifact=${a.id}`);
      const href = artifact.dataUrl || URL.createObjectURL(new Blob([artifact.content || ""], { type: artifact.type === "website" ? "text/html" : "text/plain" }));
      const link = document.createElement("a");
      link.href = href; link.download = a.name || "artifact"; link.click();
    } catch (err) { setError((err as Error).message); }
  }

  function saveKey(e: React.FormEvent) { e.preventDefault(); storageSet(keyDraft.trim()); setApiKey(keyDraft.trim()); }

  if (!apiKey) {
    return (
      <main className={styles.page}>
        <form className={styles.keyCard} onSubmit={saveKey}>
          <h1>Core Engine · Runs</h1>
          <p>Podaj klucz operatora (<code>CORE_ENGINE_API_KEY</code>). Zostaje tylko w tej karcie przeglądarki.</p>
          <input type="password" autoComplete="off" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="klucz API" aria-label="Klucz API" />
          <button type="submit" disabled={!keyDraft.trim()}>Zaloguj</button>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/runtime" className={styles.back}>← Runtime</Link>
          <h1>Agent runs</h1>
        </div>
        <button className={styles.ghost} onClick={() => { storageSet(""); setApiKey(""); setKeyDraft(""); setRuns([]); setSelected(null); setRun(null); }}>Wyloguj</button>
      </header>
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.grid}>
        <aside className={styles.side}>
          <form className={styles.card} onSubmit={createRun}>
            <h2>Nowy run</h2>
            <label>Cel<textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={5} placeholder="Np. Zbuduj moduł faktur z testami i uruchom testy aż przejdą." required /></label>
            <label>Kryteria akceptacji (jedno na linię)<textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={3} placeholder={"Moduł invoice.py\nMin. 5 testów\nTesty przechodzą"} /></label>
            <div className={styles.row}>
              <label>Budżet USD<input type="number" min="0.05" step="0.05" value={maxCost} onChange={(e) => setMaxCost(e.target.value)} /></label>
              <label>Max kroków<input type="number" min="1" max="200" value={maxSteps} onChange={(e) => setMaxSteps(e.target.value)} /></label>
            </div>
            <button type="submit" disabled={busy || !goal.trim()}>{busy ? "…" : "Uruchom"}</button>
          </form>

          <div className={styles.card}>
            <h2>Historia</h2>
            {!runs.length && <p className={styles.muted}>Brak runów.</p>}
            <ul className={styles.list}>
              {runs.map((r) => (
                <li key={r.id}>
                  <button className={r.id === selected ? styles.active : ""} onClick={() => select(r.id)}>
                    <span className={styles.badge} data-status={r.status}>{r.status}</span>
                    <span className={styles.goal}>{r.goal}</span>
                    <span className={styles.muted}>{usd(r.usage.costUsd)} · {r.usage.steps} kroków</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className={styles.detail}>
          {!run && <div className={styles.card}><p className={styles.muted}>Wybierz run z listy albo uruchom nowy.</p></div>}
          {run && (
            <>
              <div className={styles.card}>
                <div className={styles.titleRow}>
                  <span className={styles.badge} data-status={run.status}>{run.status}</span>
                  {ACTIVE.includes(run.status) && <span className={styles.pulse} aria-label="w toku" />}
                  <div className={styles.actions}>
                    {ACTIVE.includes(run.status) || run.status === "WAITING_APPROVAL" ? <button className={styles.ghost} disabled={busy} onClick={() => action("cancel")}>Anuluj</button> : null}
                    {["BUDGET_EXHAUSTED", "FAILED"].includes(run.status) && <button disabled={busy} onClick={() => action("resume")}>Wznów (+20 kroków, +$1)</button>}
                  </div>
                </div>
                <p className={styles.goalFull}>{run.goal}</p>
                <dl className={styles.stats}>
                  <div><dt>Kroki</dt><dd>{run.usage.steps} / {run.budget.maxSteps}</dd></div>
                  <div><dt>Koszt</dt><dd>{usd(run.usage.costUsd)} / {usd(run.budget.maxCostUsd)}</dd></div>
                  <div><dt>Czas aktywny</dt><dd>{secs(run.usage.activeMs)}</dd></div>
                  <div><dt>Tokeny</dt><dd>{(run.usage.promptTokens + run.usage.completionTokens).toLocaleString("pl-PL")}</dd></div>
                </dl>
                {run.error && <p className={styles.errorText}>Błąd: {run.error}</p>}
              </div>

              {run.pendingApproval && (
                <div className={`${styles.card} ${styles.approval}`}>
                  <h2>Wymaga akceptacji: {run.pendingApproval.toolName}</h2>
                  <pre>{JSON.stringify(run.pendingApproval.arguments, null, 2)}</pre>
                  <div className={styles.row}>
                    <button disabled={busy} onClick={() => action("approve")}>Zatwierdź</button>
                    <button className={styles.danger} disabled={busy} onClick={() => action("reject")}>Odrzuć</button>
                  </div>
                </div>
              )}

              {run.result && (
                <div className={styles.card}>
                  <h2>Wynik</h2>
                  <p className={styles.pre}>{run.result.summary}</p>
                  {run.result.criteria.length > 0 && (
                    <ul className={styles.criteria}>
                      {run.result.criteria.map((c) => <li key={c.criterion} data-met={c.met}><strong>{c.met ? "✓" : "✗"} {c.criterion}</strong><span>{c.evidence}</span></li>)}
                    </ul>
                  )}
                </div>
              )}

              {run.progress.plan && <div className={styles.card}><h2>Plan</h2><pre>{run.progress.plan}</pre></div>}

              <div className={styles.card}>
                <h2>Kroki ({run.steps.length})</h2>
                <ol className={styles.steps}>
                  {run.steps.map((s) => (
                    <li key={s.index} data-kind={s.kind} data-status={s.toolStatus || ""}>
                      <span className={styles.stepKind}>{s.kind}</span>
                      <span>{s.summary}</span>
                      {s.error && <span className={styles.errorText}>{s.error}</span>}
                    </li>
                  ))}
                </ol>
              </div>

              {Object.keys(run.workspace).length > 0 && (
                <div className={styles.card}>
                  <h2>Workspace</h2>
                  <ul className={styles.files}>
                    {Object.entries(run.workspace).map(([path, meta]) => (
                      <li key={path}><button className={openFile === path ? styles.active : ""} onClick={() => setOpenFile(openFile === path ? null : path)}>{path} <span className={styles.muted}>{meta.bytes} B</span></button></li>
                    ))}
                  </ul>
                  {openFile && run.workspaceFiles?.[openFile] !== undefined && <pre className={styles.code}>{run.workspaceFiles[openFile]}</pre>}
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
            </>
          )}
        </section>
      </div>
    </main>
  );
}
