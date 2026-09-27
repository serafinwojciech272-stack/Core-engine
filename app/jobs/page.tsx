"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Check, CircleDot, Loader2, Search, ShieldCheck, Zap } from "lucide-react";

type Job = {
  title: string;
  company: string;
  location: string;
  salary: string;
  match: number;
  reason: string;
  source: string;
  applyMode: "AUTO" | "REVIEW";
};

const demoJobs: Job[] = [
  { title: "Business Development Manager", company: "Industrial Technology", location: "Gliwice / hybrid", salary: "18,000–24,000 PLN", match: 94, reason: "German + English + commercial management", source: "Employer ATS", applyMode: "AUTO" },
  { title: "Customer Experience Manager", company: "B2B Services", location: "Zabrze / hybrid", salary: "15,000–21,000 PLN", match: 91, reason: "Customer service + process + team leadership", source: "Employer ATS", applyMode: "AUTO" },
  { title: "Key Account Manager", company: "International Manufacturing", location: "Silesia / hybrid", salary: "16,000–23,000 PLN", match: 88, reason: "Sales + German + account ownership", source: "Career site", applyMode: "REVIEW" }
];

export default function JobsPage() {
  const [running, setRunning] = useState(false);
  const [decision, setDecision] = useState<{ recommendation: string; diagnosis: string; confidence: number; priority: string } | null>(null);
  const [autoApply, setAutoApply] = useState(true);
  const [status, setStatus] = useState("");

  const criteria = useMemo(() => [
    "Gliwice / Zabrze + 30 km",
    "German B2+",
    "English B2+",
    "Management / commercial experience",
    "No driving licence required",
    "Business Development / Operations / CX / Sales / Account"
  ], []);

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

  function apply(job: Job) {
    if (job.applyMode === "AUTO" && autoApply) {
      setStatus("Application queued through the permitted provider path. The engine keeps a receipt for every action.");
    } else {
      setStatus("Application opened for review before submission.");
    }
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
              <div><div className="card-label">APPLICATION MODE</div><b>{autoApply ? "AUTO WHERE PERMITTED" : "REVIEW BEFORE SUBMIT"}</b></div>
              <button className={"toggle " + (autoApply ? "on" : "")} onClick={() => setAutoApply(v => !v)} aria-pressed={autoApply}><span/></button>
            </div>
            <button className="primary jobs-run" onClick={runCoreEngine} disabled={running}>
              {running ? <Loader2 size={16} className="spin"/> : <Zap size={16}/>}
              {running ? "Core Engine running..." : "Run Core Engine"}
            </button>
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
              <p>Run the engine. It will turn your constraints into an explicit search policy before applications start.</p>
            </>}
          </section>
        </div>
      </section>

      <section className="jobs-results">
        <div className="results-head">
          <div><div className="card-label">OPPORTUNITY PIPELINE</div><h2>Relevant openings</h2></div>
          <span><Search size={14}/> {demoJobs.length} demo matches</span>
        </div>
        <div className="job-list">
          {demoJobs.map(job => <article className="job-card" key={job.title}>
            <div className="job-main">
              <div className="match">{job.match}%</div>
              <div><h3>{job.title}</h3><p>{job.company} · {job.location}</p><small>{job.reason}</small></div>
            </div>
            <div className="job-meta"><b>{job.salary}</b><span>{job.source}</span></div>
            <button className="apply" onClick={() => apply(job)}>{job.applyMode === "AUTO" && autoApply ? "AUTO APPLY" : "REVIEW & APPLY"} <ArrowRight size={14}/></button>
          </article>)}
        </div>
        <div className="guard"><ShieldCheck size={16}/><span>Execution follows the Core Engine approval and capability policy. Job platforms that prohibit third-party automation stay in review mode.</span></div>
      </section>

      <footer><span>CORE ENGINE · JOB AGENT</span><span>Observe → Understand → Prioritize → Decide → Approve → Execute → Measure → Learn</span></footer>
    </main>
  );
}
