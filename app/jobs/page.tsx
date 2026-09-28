"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Check, CircleDot, Loader2, RefreshCw, Search, ShieldCheck, Zap } from "lucide-react";

type Job = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  match_score: number | null;
  source: string;
  url: string;
  decision: string | null;
  status: string | null;
};

type Decision = { recommendation: string; diagnosis: string; confidence: number; priority: string };

export default function JobsPage() {
  const [running, setRunning] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [autoApply] = useState(false);
  const [status, setStatus] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [latestSync, setLatestSync] = useState<{ finished_at?: string; discovered?: number; inserted?: number; status?: string } | null>(null);

  const criteria = useMemo(() => [
    "Gliwice / Zabrze + 30 km",
    "German B2+",
    "English B2+",
    "Management / commercial experience",
    "No driving licence required",
    "Business Development / Operations / CX / Sales / Account"
  ], []);

  async function loadJobs() {
    setLoadingJobs(true);
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Job feed unavailable");
      setJobs(data.jobs || []);\n      setLatestSync(data.latestSync || null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Job feed unavailable");
    } finally {
      setLoadingJobs(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/jobs", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Job feed unavailable");
        if (active) { setJobs(data.jobs || []); setLatestSync(data.latestSync || null); }
      })
      .catch(error => {
        if (active) setStatus(error instanceof Error ? error.message : "Job feed unavailable");
      })
      .finally(() => {
        if (active) setLoadingJobs(false);
      });
    return () => { active = false; };
  }, []);

  async function runCoreEngine() {
    setRunning(true);
    setStatus("");
    try {
      const signals = [
        { name: "target_roles", value: "Business Development Manager; Operations Manager; Customer Experience Manager; Sales Manager; Account Manager; Key Account Manager", source: "candidate_profile" },
        { name: "location_radius", value: "Gliwice/Zabrze + 30 km", source: "candidate_preference" },
        { name: "german_level", value: "B2+", source: "candidate_profile" },
        { name: "english_level", value: "B2+", source: "candidate_profile" },
        { name: "management_experience", value: "yes", source: "candidate_profile" },
        { name: "driving_license", value: "none", source: "candidate_constraint" },
        { name: "application_mode", value: autoApply ? "AUTO_WHERE_PROVIDER_PERMITS" : "REVIEW_BEFORE_SUBMIT", source: "user_policy" }
      ];
      const r = await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ domain: "jobs", signals })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Core Engine request failed");
      setDecision(data.decision);
      setStatus("Core Engine generated the job-search policy.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Core Engine request failed");
    } finally {
      setRunning(false);
    }
  }

  async function syncJobs() {
    setRunning(true);
    setStatus("Synchronizing the opportunity pipeline...");
    try {
      const r = await fetch("/api/jobs/sync", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Sync failed");
      setStatus(`Sync complete: ${data.sync.discovered} discovered, ${data.sync.inserted} stored.`);
      await loadJobs();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setRunning(false);
    }
  }

  function apply(job: Job) {
    window.open(job.url, "_blank", "noopener,noreferrer");
    setStatus("Provider page opened. Submission remains under the Core Engine approval policy.");
  }

  return (
    <main className="jobs-page">
      <nav>
        <div className="brand"><span className="mark"><BrainCircuit size={19}/></span><span>CORE ENGINE / JOB AGENT</span></div>
        <Link className="navbtn" href="/">Core Engine <ArrowRight size={15}/></Link>
      </nav>

      <section className="jobs-hero">
        <div className="eyebrow"><span className="pulse"/> AI JOB SEARCH + APPLICATION AGENT</div>
        <h1>Find the right work.<br/><em>Let the engine decide.</em></h1>
        <p className="lead">Core Engine converts your profile, constraints and market signals into a job-search policy, ranks opportunities, and routes applications through an approval-controlled execution layer.</p>

        <div className="jobs-grid">
          <section className="profile-card">
            <div className="card-label">ENGINE INPUT</div>
            <h2>Your job policy</h2>
            <div className="criteria">
              {criteria.map(x => <div key={x}><Check size={14}/><span>{x}</span></div>)}
            </div>
            <div className="mode-row">
              <div><div className="card-label">APPLICATION MODE</div><b>"REVIEW BEFORE SUBMIT"</b></div>
              <button className={"toggle " + (autoApply ? "on" : "")} disabled aria-pressed={false}><span/></button>
            </div>
            <div className="jobs-actions">
              <button className="primary jobs-run" onClick={runCoreEngine} disabled={running}>
                {running ? <Loader2 size={16} className="spin"/> : <Zap size={16}/>}
                {running ? "Core Engine running..." : "Run Core Engine"}
              </button>
              <button className="secondary jobs-run" onClick={syncJobs} disabled={running}>
                {running ? <Loader2 size={16} className="spin"/> : <RefreshCw size={16}/>}
                Sync opportunities
              </button>
            </div>
            {status && <div className="engine-status"><CircleDot size={13}/>{status}</div>}
          </section>

          <section className="decision-card">
            <div className="card-label">DECISION LAYER</div>
            {decision ? <>
              <div className="decision-state">POLICY GENERATED</div>
              <h2>{decision.recommendation}</h2>
              <p>{decision.diagnosis}</p>
              <div className="decision-stats">
                <div><small>CONFIDENCE</small><strong>{Math.round(decision.confidence * 100)}%</strong></div>
                <div><small>PRIORITY</small><strong>{decision.priority}</strong></div>
              </div>
            </> : <>
              <div className="decision-orb"><BrainCircuit size={34}/></div>
              <h2>Waiting for evidence</h2>
              <p>Run the engine. It will turn your constraints into an explicit search policy. Live discovery remains provider-aware and every submission stays behind human review.</p>
            </>}
          </section>
        </div>
      </section>

      <section className="jobs-results">
        <div className="results-head">
          <div><div className="card-label">LIVE OPPORTUNITY PIPELINE</div><h2>Relevant openings</h2></div>
          <span><Search size={14}/> {loadingJobs ? "loading..." : `${jobs.length} matches`}</span>
        </div>
        <div className="job-list">
          {jobs.map(job => <article className="job-card" key={job.id}>
            <div className="job-main">
              <div className="match">{Math.round(job.match_score ?? 0)}%</div>
              <div><h3>{job.title}</h3><p>{job.company || "Company not extracted"} · {job.location || "Location not extracted"}</p><small>{job.source} · {job.decision || "REVIEW"}</small></div>
            </div>
            <div className="job-meta"><b>{job.salary || "Salary not disclosed"}</b><span>{job.status || "NEW"}</span></div>
            <button className="apply" onClick={() => apply(job)}>OPEN & REVIEW <ArrowRight size={14}/></button>
          </article>)}
          {!loadingJobs && jobs.length === 0 && <div className="empty-state">No synchronized opportunities yet. Check the LIVE runtime status, then run a sync. If the search provider is not configured, the status will identify the missing server configuration.</div>}
        </div>
        <div className="guard"><ShieldCheck size={16}/><span>LIVE WEB discovery is provider-aware. Applications are REVIEW BEFORE SUBMIT; no provider submission is performed automatically.</span></div>\n        {latestSync && <div className="guard"><CircleDot size={16}/><span>Last sync: {latestSync.status || "UNKNOWN"} · {latestSync.discovered ?? 0} discovered · {latestSync.inserted ?? 0} stored</span></div>}
      </section>

      <footer><span>CORE ENGINE · JOB AGENT</span><span>Observe → Understand → Prioritize → Decide → Approve → Execute → Measure → Learn</span></footer>
    </main>
  );
}
