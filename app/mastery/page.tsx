"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Clock3, FlaskConical, GitBranch, Radar, RefreshCw, Search, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import type { MasteryProfile, MasteryRoadmap } from "@/lib/mastery-engine/contracts";
import styles from "./mastery.module.css";

type State = { profile: MasteryProfile; roadmap: MasteryRoadmap };

export default function MasteryPage() {
  const [state, setState] = useState<State | null>(null);
  const [daily, setDaily] = useState<Record<string, unknown> | null>(null);
  const [research, setResearch] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function call(body: Record<string, unknown>) {
    const response = await fetch("/api/mastery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Mastery request failed");
    return data;
  }

  async function load() {
    setBusy("load"); setError("");
    try { const response = await fetch("/api/mastery"); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Load failed"); setState(data.state); }
    catch (e) { setError(e instanceof Error ? e.message : "Load failed"); } finally { setBusy(""); }
  }

  async function run(action: string) {
    setBusy(action); setError("");
    try {
      const data = await call(action === "assess" ? { action, answers } : action === "research" ? { action, topic } : { action });
      if (data.state) setState(data.state);
      if (data.profile) setState((s) => s ? { ...s, profile: data.profile } : s);
      if (data.roadmap) setState((s) => s ? { ...s, roadmap: data.roadmap } : s);
      if (data.daily) setDaily(data.daily);
      if (data.research) setResearch(data.research);
    } catch (e) { setError(e instanceof Error ? e.message : "Operation failed"); } finally { setBusy(""); }
  }

  useEffect(() => { void load(); }, []);

  const active = useMemo(() => state?.roadmap.stages.find((x) => x.status === "READY" || x.status === "ACTIVE") || state?.roadmap.stages[0], [state]);
  const completed = state?.roadmap.stages.filter((x) => x.status === "COMPLETE").length || 0;
  const average = state ? Object.values(state.profile.domains).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(state.profile.domains).length) : 0;

  return <main className={styles.shell}>
    <header className={styles.nav}>
      <a className={styles.brand} href="/"><span className={styles.mark}><BrainCircuit size={18} /></span> AI MASTERY ENGINE</a>
      <div className={styles.navMeta}><span><span className={styles.liveDot} /> CORE ENGINE CONNECTED</span><span>OPENROUTER ROUTING</span><span>v1.0</span></div>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}><Sparkles size={13} /> PERSONAL AI MASTERY CONTROL PLANE</div>
        <h1>Build the capability.<br /><em>Verify the evidence.</em></h1>
        <p>AI Mastery turns your AI learning into an adaptive engineering system. Learn, build, test, verify, research and monetize in one continuous loop.</p>
        <div className={styles.actions}>
          <button onClick={() => run("daily")} disabled={!!busy}><Zap size={15} /> {busy === "daily" ? "GENERATING" : "START TODAY"}</button>
          <button className={styles.ghost} onClick={() => run("roadmap")} disabled={!!busy}><RefreshCw size={14} /> REFRESH ROADMAP</button>
        </div>
      </div>
      <div className={styles.heroOrb}><div className={styles.orbCore}><BrainCircuit size={44} /></div><span>ADAPTIVE</span><small>evidence-driven</small></div>
    </section>

    {error && <div className={styles.error}>{error}</div>}

    <section className={styles.metrics}>
      <div><span>MASTERY</span><strong>{state?.profile.currentLevel || "UNASSESSED"}</strong><small>{state ? state.profile.overall.toFixed(1) : "0.0"} / 5.0</small></div>
      <div><span>ROADMAP</span><strong>2026 → 2031</strong><small>{completed} / {state?.roadmap.stages.length || 12} stages complete</small></div>
      <div><span>SKILL COVERAGE</span><strong>{Math.round(average * 20)}%</strong><small>verified baseline pending</small></div>
      <div><span>NEXT ACTION</span><strong>{active?.title || "Baseline"}</strong><small>{state?.roadmap.nextAction || "Run assessment"}</small></div>
    </section>

    <section className={styles.grid}>
      <article className={styles.card + " " + styles.next}>
        <div className={styles.cardHead}><span><Target size={14} /> CURRENT MISSION</span><b>01</b></div>
        <h2>{active?.title || "Baseline assessment"}</h2>
        <p>{active?.objective || "Establish your initial competency baseline before optimizing the roadmap."}</p>
        <div className={styles.missionLine}><span>PROJECT</span><strong>{active?.project || "AI Mastery Baseline"}</strong></div>
        <div className={styles.missionLine}><span>PROOF</span><strong>{active?.evidence?.join(" · ") || "Assessment evidence"}</strong></div>
        <button className={styles.inline} onClick={() => document.getElementById("assessment")?.scrollIntoView({ behavior: "smooth" })}>RUN ASSESSMENT <ArrowRight size={13} /></button>
      </article>

      <article className={styles.card}>
        <div className={styles.cardHead}><span><Activity size={14} /> CORE ENGINE FABRIC</span><b>LIVE</b></div>
        <div className={styles.fabric}><div><GitBranch /><span>Context</span></div><i>→</i><div><BrainCircuit /><span>Reasoning</span></div><i>→</i><div><ShieldCheck /><span>Verification</span></div><i>→</i><div><CheckCircle2 /><span>Evidence</span></div></div>
        <p className={styles.muted}>Mastery state is designed to reuse Core Engine routing, memory, skills, policy, verification and persistence rather than creating a parallel AI stack.</p>
      </article>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>ROADMAP</span><h2>2026 → 2031</h2></div><span className={styles.badge}>{state?.roadmap.version || "ROADMAP v1.0"}</span></div>
      <div className={styles.timeline}>{state?.roadmap.stages.map((stage, i) => <div key={stage.id} className={styles.stage + " " + (stage.status === "READY" || stage.status === "ACTIVE" ? styles.activeStage : "")}>
        <div className={styles.stageTop}><span>{stage.id}</span><small>{stage.year} · {stage.quarter}</small></div>
        <h3>{stage.title}</h3><p>{stage.objective}</p><div className={styles.project}><FlaskConical size={13} /> {stage.project}</div>
        <div className={styles.stageFoot}><span>{stage.status}</span><span>{stage.monetization}</span></div>
        {i < (state?.roadmap.stages.length || 0) - 1 && <div className={styles.connector} />}
      </div>)}</div>
    </section>

    <section className={styles.section} id="assessment">
      <div className={styles.sectionHead}><div><span>ASSESSMENT ENGINE</span><h2>Measure before optimizing.</h2></div><span className={styles.badge}>PROVISIONAL → VERIFIED</span></div>
      <div className={styles.assessGrid}>
        <div className={styles.card}>
          <p className={styles.muted}>Describe your current AI experience. Include what you have built, languages you use, agent systems, LLM APIs, databases, deployments, research habits and any work you have sold.</p>
          <textarea value={answers} onChange={(e) => setAnswers(e.target.value)} placeholder="Example: I build TypeScript systems, use Core Engine, connect OpenRouter, work with Supabase and deploy to Render..." />
          <button onClick={() => run("assess")} disabled={!answers.trim() || !!busy}><Radar size={15} /> {busy === "assess" ? "ASSESSING" : "ASSESS MY BASELINE"}</button>
        </div>
        <div className={styles.card}>
          <div className={styles.skillGrid}>{state?.profile.skills.slice(0, 12).map(skill => <div key={skill.id} className={styles.skill}><span>{skill.name}</span><b>{skill.level}/5</b><i><u style={{ width: (skill.level / 5) * 100 + "%" }} /></i></div>)}</div>
        </div>
      </div>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>DAILY MASTER</span><h2>One objective. One verified result.</h2></div><Clock3 size={18} /></div>
      <div className={styles.daily}>
        {daily ? Object.entries(daily).filter(([k]) => k !== "expectedResult").map(([k, v]) => <div key={k}><span>{k.replace(/[A-Z]/g, m => " " + m).toUpperCase()}</span><p>{Array.isArray(v) ? v.join(" · ") : String(v)}</p></div>) : <p className={styles.muted}>Generate today's plan. The agent will optimize it against your current profile and roadmap.</p>}
      </div>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>RESEARCH MONITOR</span><h2>Stay ahead without chasing hype.</h2></div><Search size={18} /></div>
      <div className={styles.researchBar}><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. AI agents, model routing, multimodal models" /><button onClick={() => run("research")} disabled={!topic.trim() || !!busy}><Search size={14} /> RESEARCH</button></div>
      {research && <div className={styles.research}><div><span>TOPIC</span><strong>{String(research.topic)}</strong></div><p>{String(research.result)}</p><small>request {String(research.requestId || "n/a")}</small></div>}
    </section>

    <footer className={styles.footer}><span>AI MASTERY ENGINE · CORE ENGINE AI</span><span>Build → Verify → Ship → Monetize → Teach</span></footer>
  </main>;
}
