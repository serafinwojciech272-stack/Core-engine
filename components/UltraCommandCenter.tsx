"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Circle, Database, Gauge, GitBranch, LockKeyhole, Play, Radar, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";

type Json = Record<string, any>;
const domains = {
  Growth: [{ name: "conversion_rate", value: "2.8%", source: "analytics" }, { name: "traffic", value: "+18%", source: "analytics" }, { name: "checkout_dropoff", value: "41%", source: "funnel" }],
  Sales: [{ name: "qualified_leads", value: "-14%", source: "CRM" }, { name: "response_time", value: "11h", source: "CRM" }, { name: "win_rate", value: "18%", source: "sales" }],
  Operations: [{ name: "order_backlog", value: "+27%", source: "operations" }, { name: "cycle_time", value: "3.4d", source: "ERP" }, { name: "capacity", value: "82%", source: "workforce" }],
} as const;
const stages = ["OBSERVE", "CONTEXT", "EVIDENCE", "DIAGNOSE", "DECIDE", "MISSION", "APPROVAL", "EXECUTE", "MEASURE", "LEARN"];

export default function UltraCommandCenter() {
  const [domain, setDomain] = useState<keyof typeof domains>("Growth");
  const [runtime, setRuntime] = useState<Json | null>(null);
  const [agent, setAgent] = useState<Json | null>(null);
  const [result, setResult] = useState<Json | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [missionBusy, setMissionBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/engine", { headers: { Accept: "application/json" } }).then(r => r.json()),
      fetch("/api/agent", { headers: { Accept: "application/json" } }).then(r => r.json())
    ]).then(([engine, agentData]) => { setRuntime(engine); setAgent(agentData); }).catch(() => { setRuntime(null); setAgent(null); });
  }, []);

  const trace = result?.trace ?? [];
  const completed = useMemo(() => {
    const done = new Set(trace.filter((x: Json) => ["COMPLETE", "CREATED", "PASS"].includes(String(x.status).toUpperCase())).map((x: Json) => String(x.stage).toUpperCase().replace(/[^A-Z]/g, "")));
    if (result?.mission?.id) done.add("MISSION");
    if (["APPROVED", "EXECUTING", "MEASURING", "COMPLETED", "LEARNED"].includes(String(result?.mission?.state))) done.add("APPROVAL");
    if (["EXECUTING", "MEASURING", "COMPLETED", "LEARNED"].includes(String(result?.mission?.state))) done.add("EXECUTE");
    if (["MEASURING", "COMPLETED", "LEARNED"].includes(String(result?.mission?.state))) done.add("MEASURE");
    if (result?.mission?.state === "LEARNED") done.add("LEARN");
    return done;
  }, [trace, result?.mission?.id, result?.mission?.state]);

  async function run() {
    setRunning(true); setError(""); setResult(null);
    try {
      const r = await fetch("/api/engine?demo=investor-v1", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ signals: domains[domain], domain: domain.toLowerCase(), demo: true }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "ENGINE_REQUEST_FAILED");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "ENGINE_REQUEST_FAILED"); }
    finally { setRunning(false); }
  }

  async function mission(action: string) {
    if (!result?.mission?.id) return;
    setMissionBusy(true); setError("");
    try {
      const r = await fetch("/api/mission", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ id: result.mission.id, action, idempotencyKey: crypto.randomUUID(), outcome: { before: 100, after: action === "measure" ? 112 : 120, direction: "higher" } }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "MISSION_OPERATION_FAILED");
      setResult((old: Json) => ({ ...old, ...data, mission: data.mission, state: data.mission?.state, trace: data.trace ?? old.trace }));
    } catch (e) { setError(e instanceof Error ? e.message : "MISSION_OPERATION_FAILED"); }
    finally { setMissionBusy(false); }
  }

  const state = result?.mission?.state;
  const next = state === "AWAITING_APPROVAL" ? "approve" : state === "APPROVED" ? "execute" : state === "EXECUTING" ? "measure" : state === "MEASURING" ? "complete" : state === "COMPLETED" ? "learn" : "";
  const evidenceScore = result?.evidenceQuality?.score;
  const confidence = Number(result?.decision?.confidence);

  return <section className="ultra-shell" id="top">
    <div className="ultra-noise" />
    <div className="ultra-orbit ultra-o1" /><div className="ultra-orbit ultra-o2" /><div className="ultra-orbit ultra-o3" />
    <header className="ultra-topbar">
      <div className="ultra-brand"><span><BrainCircuit size={18}/></span><b>CORE ENGINE</b><small>AI CONTROL PLANE</small></div>
      <div className="ultra-live"><i /> LIVE INTELLIGENCE FABRIC</div>
      <div className="ultra-toplinks"><a href="#portfolio">PORTFOLIO <ArrowRight size={13}/></a><a href="#roadmap">ROADMAP</a></div>
    </header>

    <div className="ultra-hero">
      <div className="ultra-kicker"><span>INVESTOR EXPERIENCE 03</span><em>AGENT RUNTIME · {agent?.runtime?.status || "CONNECTING"}</em></div>
      <h1>Intelligence<br/><span>in motion.</span></h1>
      <p>One control plane turns fragmented business signals into evidence, decisions, governed missions and measurable learning. The same agent contract powers every product surface.</p>
      <div className="ultra-hero-actions"><a className="ultra-primary" href="#ultra-demo"><Play size={15}/> RUN THE CORE</a><a className="ultra-secondary" href="#ultra-map">VIEW SYSTEM MAP <ArrowRight size={14}/></a></div>
      <div className="ultra-proof"><span><ShieldCheck size={14}/> evidence first</span><span><LockKeyhole size={14}/> approval boundary</span><span><GitBranch size={14}/> auditable state</span></div>
    </div>

    <div className="ultra-command" id="ultra-demo">
      <div className="ultra-command-head"><div><span className="ultra-label">01 / SIGNAL INTAKE · SIMULATED DEMO INPUT</span><h2>Give the core a business situation.</h2></div><div className="ultra-runtime"><i/>{agent?.runtime?.status || runtime?.status || "CONNECTING"} <b>{runtime?.version || "CORE"}</b></div></div>
      <div className="ultra-input-grid">
        <div className="ultra-domain-tabs">{(Object.keys(domains) as Array<keyof typeof domains>).map(d => <button key={d} onClick={() => setDomain(d)} className={d === domain ? "active" : ""}><Activity size={14}/>{d}</button>)}</div>
        <div className="ultra-signals">{domains[domain].map(s => <div key={s.name}><small>{s.source}</small><b>{s.name}</b><strong>{s.value}</strong></div>)}</div>
        <button className="ultra-run" onClick={run} disabled={running}>{running ? <><Sparkles className="ultra-spin" size={16}/> REASONING...</> : <><Zap size={16}/> ACTIVATE CORE</>}</button>
      </div>

      <div className="ultra-statebar">
        {stages.map((stage, i) => <div key={stage} className={completed.has(stage) ? "done" : ""}><span>{completed.has(stage) ? <CheckCircle2 size={13}/> : <Circle size={13}/>}</span><b>{stage}</b>{i < stages.length - 1 && <i/>}</div>)}
      </div>

      {result && <div className="ultra-results">
        <div className="ultra-result-head"><div><span className="ultra-label">02 / ENGINE OUTPUT</span><h2>{result.engine || "CORE ENGINE"}<small> · {result.version || "runtime"}</small></h2></div><div className="ultra-state"><i/>{result.state || "ANALYZED"}</div></div>
        <div className="ultra-agent-strip"><span>AGENT CONTRACT</span><b>{agent?.agent?.name || "Core Engine Agent"}</b><small>{agent?.agent?.contract || "agent-runtime"} · {agent?.agent?.autonomy || "HUMAN_APPROVED"} · {agent?.runtime?.persistence || "runtime persistence"} · {agent?.runtime?.capabilityPacks ?? 0} capability packs · external side effects {agent?.runtime?.liveExternalSideEffects ? "enabled" : "disabled"}</small></div><div className="ultra-metrics">
          <div><small>CONFIDENCE</small><strong>{Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "N/A"}</strong><span>decision matrix</span></div>
          <div><small>EVIDENCE QUALITY</small><strong>{typeof evidenceScore === "number" ? `${evidenceScore}` : "N/A"}</strong><span>provenance score</span></div>
          <div><small>RISK GATE</small><strong>{result.decision?.riskGate || "PASS"}</strong><span>policy evaluation</span></div>
          <div><small>AUDIT CHAIN</small><strong>{result.audit?.chainLength ?? 0}</strong><span>{result.audit?.integrity || "pending"}</span></div>
        </div>
        <div className="ultra-decision"><div className="ultra-decision-main"><span className="ultra-label">DECISION CENTER</span><h3>{result.decision?.recommendation || "Decision generated"}</h3><p>{result.decision?.diagnosis || "The core has processed the supplied signals."}</p></div><div className="ultra-decision-side"><small>PRIORITY</small><b>{result.decision?.priority || "N/A"}</b><small>REASONING SOURCE</small><b>{result.decision?.reasoningSource || "Core"}</b></div></div>
        <div className="ultra-evidence"><div className="ultra-label">EVIDENCE GRAPH</div>{(result.decision?.evidence || result.evidence || []).slice(0, 8).map((e: any, i: number) => <div key={typeof e === "string" ? e : e.id || i}><span>{String(i + 1).padStart(2,"0")}</span><b>{typeof e === "string" ? e : e.claim || e.id || "evidence node"}</b><small>{typeof e === "string" ? "verified node" : e.source || "source"}</small></div>)}</div>
        {result.mission && <div className="ultra-mission"><div><span className="ultra-label">MISSION CONTROL</span><h3>{result.mission.objective}</h3><p>Current state: <b>{state}</b> · governed transition · demo outcome verification enabled</p></div><div className="ultra-mission-actions">{next ? <button onClick={() => mission(next)} disabled={missionBusy}>{missionBusy ? <Sparkles className="ultra-spin" size={14}/> : <ArrowRight size={14}/>} {missionBusy ? "PROCESSING" : next.toUpperCase()}</button> : <span><CheckCircle2 size={15}/> LEARNING COMPLETE</span>}</div></div>}
        {result.audit && <div className="ultra-audit"><div><span className="ultra-label">AUDIT CHAIN</span><h3>{result.audit.algorithm || "Cryptographic provenance"}</h3></div><code>HEAD · {result.audit.head || "N/A"}</code><b>{result.audit.integrity}</b></div>}
      </div>}
      {error && <div className="ultra-error">CORE ERROR · {error}</div>}
    </div>

    <div className="ultra-map" id="ultra-map">
      <div className="ultra-section-title"><span>03 / INTELLIGENCE FABRIC</span><h2>One core.<br/><i>Seven control layers.</i></h2></div>
      <div className="ultra-layer-stack">{[
        ["01","CONTEXT ENGINE","Normalizes signals, domain and operating context",Database],
        ["02","EVIDENCE GRAPH","Connects claims, sources and provenance",Radar],
        ["03","DECISION MATRIX","Scores priority, confidence and recommendation",Gauge],
        ["04","RISK GATE","Applies policy before consequential action",ShieldCheck],
        ["05","MISSION ENGINE","Turns decisions into stateful work",Target],
        ["06","CAPABILITY FABRIC","Maps approved missions to controlled actions",Zap],
        ["07","OUTCOME + LEARNING","Measures results and feeds the next decision",BrainCircuit],
      ].map(([n,t,d,Icon]) => <article key={n as string}><span>{n as string}</span><Icon size={18}/><div><b>{t as string}</b><p>{d as string}</p></div><ArrowRight size={14}/></article>)}</div>
    </div>

    <div className="ultra-portfolio" id="portfolio">
      <div className="ultra-section-title"><span>04 / PRODUCT SURFACES</span><h2>The same intelligence.<br/><i>Three environments.</i></h2></div>
      <div className="ultra-products">
        <article className="u-orange"><Target/><small>01 / DECISION INTELLIGENCE</small><h3>Bet Builder</h3><p>Events → analysis → research → evidence → decision → mission.</p><b>PROOF SURFACE</b></article>
        <article className="u-violet"><Gauge/><small>02 / BUSINESS OPERATING SYSTEM</small><h3>Growth Advisor</h3><p>Website audit → opportunity → Growth Mission → approval → outcome.</p><b>CORE PRODUCT</b></article>
        <article className="u-green"><Radar/><small>03 / OPPORTUNITY INTELLIGENCE</small><h3>Extra Szpieg</h3><p>Scan → provenance → opportunity → BUY / WATCH / PASS → alerts.</p><b>PRODUCT LAB</b></article>
      </div>
    </div>

    <div className="ultra-roadmap" id="roadmap"><div className="ultra-section-title"><span>05 / PLATFORM ROADMAP</span><h2>From working core<br/><i>to scalable platform.</i></h2></div><div className="ultra-roadmap-grid">{[["01","CORE","Agent contract, evidence, decisions and mission lifecycle"],["02","PRODUCTS","Bet Builder, Growth Advisor and Extra Szpieg as proof surfaces"],["03","DATA","Connectors, provenance and durable business context"],["04","AUTONOMY","Governed capability execution behind approval policies"],["05","LEARNING","Outcome feedback and reusable intelligence"],["06","PLATFORM","Tenancy, auth, metering and enterprise control"]].map(([n,t,d]) => <article key={n}><span>{n}</span><b>{t}</b><p>{d}</p><i/></article>)}</div></div><footer className="ultra-footer"><div><BrainCircuit size={17}/> CORE ENGINE AI</div><span>ONE INTELLIGENCE CORE · MANY BUSINESSES</span><a href="#top">BACK TO TOP ↑</a></footer>
  </section>;
}
