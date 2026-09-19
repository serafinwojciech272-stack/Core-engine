"use client";

import { useState } from "react";
import {
  ArrowRight, BrainCircuit, CheckCircle2, ChevronRight, CircleDot, LockKeyhole,
  Play, ShieldCheck, Sparkles, Target, Zap, Loader2, Activity, BarChart3,
  Bot, RefreshCw, Terminal, XCircle
} from "lucide-react";

const steps = [
  ["01","OBSERVE","Signals, context, data"],
  ["02","DIAGNOSE","Problems, causes, opportunities"],
  ["03","PRIORITIZE","Impact, confidence, effort"],
  ["04","DECIDE","Evidence-backed recommendation"],
  ["05","EXECUTE","Approved action through tools"],
  ["06","LEARN","Measure outcome and improve"]
];

const scenarios = {
  Growth: [
    {name:"conversion_rate",value:"2.8%",source:"analytics"},
    {name:"traffic",value:"+18%",source:"analytics"},
    {name:"checkout_dropoff",value:"41%",source:"funnel"}
  ],
  Sales: [
    {name:"qualified_leads",value:"-14%",source:"CRM"},
    {name:"response_time",value:"11h",source:"CRM"},
    {name:"win_rate",value:"18%",source:"sales"}
  ],
  Operations: [
    {name:"order_backlog",value:"+27%",source:"operations"},
    {name:"cycle_time",value:"3.4d",source:"ERP"},
    {name:"capacity",value:"82%",source:"workforce"}
  ]
};

const capabilities = [
  ["Context Engine","Unify signals, history and business context","CONTEXT"],
  ["Decision Center","Rank opportunities by impact, confidence and effort","DECIDE"],
  ["Mission Engine","Turn decisions into measurable missions","MISSION"],
  ["Approval Gate","Keep high-impact actions under explicit human control","CONTROL"],
  ["Execution Layer","Connect approved actions to tools and systems","ACT"],
  ["Outcome Engine","Measure KPI movement and attribution","MEASURE"],
  ["Learning System","Reuse outcomes to improve future decisions","LEARN"]
];

export default function Home() {
  const [running,setRunning] = useState(false);
  const [result,setResult] = useState<any>(null);
  const [scenario,setScenario] = useState<keyof typeof scenarios>("Growth");
  const [actionBusy,setActionBusy] = useState("");
  const [error,setError] = useState("");

  const run = async () => {
    if (running) return;
    setRunning(true); setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch("/api/engine", {
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({signals:scenarios[scenario]}),
        signal:controller.signal,
        cache:"no-store"
      });
      const text = await r.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!r.ok) throw new Error(data?.error || "Engine request failed (" + r.status + ")");
      if (!data?.ok || !data?.decision || !data?.mission) throw new Error("Invalid engine response");
      setResult(data);
    } catch (e) {
      setError(e instanceof DOMException && e.name === "AbortError"
        ? "Engine request timed out. Check persistence/provider configuration."
        : e instanceof Error ? e.message : "Engine request failed");
    } finally {
      window.clearTimeout(timeout);
      setRunning(false);
    }
  };

  const missionAction = async (action:string) => {
    if (!result?.mission?.id) return;
    setActionBusy(action); setError("");
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const r = await fetch("/api/mission", {
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({id:result.mission.id,action}),
        signal:controller.signal,
        cache:"no-store"
      });
      const text = await r.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      window.clearTimeout(timeout);
      if (!r.ok) throw new Error(data?.error || "Mission action failed (" + r.status + ")");
      if (!data?.ok || !data?.mission) throw new Error("Invalid mission response");
      setResult((current:any)=>({...current,mission:data.mission,state:data.mission.state}));
    } catch (e) {
      setError(e instanceof DOMException && e.name === "AbortError"
        ? "Mission action timed out. Check persistent storage."
        : e instanceof Error ? e.message : "Mission action failed");
    } finally { setActionBusy(""); }
  };

  const nextAction = result?.mission?.state === "AWAITING_APPROVAL" ? "approve"
    : result?.mission?.state === "APPROVED" ? "execute"
    : result?.mission?.state === "EXECUTING" ? "measure"
    : result?.mission?.state === "MEASURING" ? "complete"
    : result?.mission?.state === "COMPLETED" ? "learn" : "";

  return <main aria-label="Core Engine AI decision and execution platform">
    <nav>
      <div className="brand"><span className="mark"><BrainCircuit size={19}/></span><span>CORE ENGINE</span></div>
      <div className="navlinks"><a href="#engine">Engine</a><a href="#architecture">Architecture</a><a href="#control">Control Center</a><a href="#products">Products</a></div>
      <button className="navbtn" type="button" onClick={run} disabled={running} aria-label="Run Core Engine intelligence demo">{running?<><Loader2 size={16} className="spin"/> Running</>:result?"Run again":"Run engine"} <ArrowRight size={16}/></button>
    </nav>

    <section className="hero">
      <div className="eyebrow"><span className="pulse"/> AI BUSINESS OPERATING SYSTEM <span className="line"/></div>
      <h1>From business signals<br/><em>to intelligent action.</em></h1>
      <p className="lead">Core Engine is the reusable intelligence layer that observes a business, diagnoses what matters, decides what to do next, creates a mission, executes approved actions, measures outcomes and learns.</p>
      <div className="actions"><button className="primary" type="button" onClick={run} disabled={running} aria-label="Run live Core Engine intelligence demo"><Play size={17} fill="currentColor"/> {running?"Running intelligence loop":"Run live intelligence demo"}</button><a className="secondary" href="#architecture">Explore the system <ChevronRight size={17}/></a></div>
      <div className="status" role="status" aria-live="polite"><span className="dot"/> {result?"DECISION + MISSION LIVE":"SYSTEM READY"} <span>•</span> decision engine <span>•</span> approval controlled <span>•</span> outcome driven</div>

      <div className="demo-bar">
        <div className="demo-copy"><span className="tag">DEMO INPUT</span><b>Choose a business signal set</b><small>Same engine, different operating context.</small></div>
        <div className="scenario-tabs">{Object.keys(scenarios).map(x=><button key={x} type="button" className={scenario===x?"selected":""} aria-pressed={scenario===x} onClick={()=>setScenario(x as keyof typeof scenarios)}><Activity size={14}/>{x}</button>)}</div>
        <div className="signal-pills">{scenarios[scenario].map(s=><span key={s.name}><b>{s.name}</b>{s.value}<i>{s.source}</i></span>)}</div>
      </div>

      {result && <section className="decision" aria-live="polite">
        <div className="decisiontop"><span className="tag">LIVE ENGINE OUTPUT</span><span className={"approved state-"+String(result.mission.state).toLowerCase()}>{result.mission.state}</span></div>
        <h3>{result.decision.recommendation}</h3><p>{result.decision.diagnosis}</p>
        <div className="decisiongrid"><div><small>CONFIDENCE</small><b>{Math.round(result.decision.confidence*100)}%</b></div><div><small>PRIORITY</small><b>{result.decision.priority}</b></div><div><small>TARGET KPI</small><b>{result.mission.kpi}</b></div></div>
        <div className="evidence"><span><BarChart3 size={14}/> Evidence</span>{result.decision.evidence.map((x:string)=><code key={x}>{x}</code>)}</div>
        <div className="trace">{result.trace.map((x:string,i:number)=><span key={x} className={i===result.trace.length-1?"current":""}>{x}</span>)}</div>
        <div className="missionbar"><div><span>MISSION</span><b>{result.mission.objective}</b></div><button className="nextaction" type="button" aria-label={nextAction ? `Mission action: ${nextAction}` : "Mission complete"} disabled={!nextAction || !!actionBusy} onClick={()=>missionAction(nextAction)}>{actionBusy?<Loader2 size={15} className="spin"/>:<Zap size={15}/>} {actionBusy?"Processing":nextAction?nextAction.toUpperCase():"Mission complete"}</button></div>
      </section>}
      {error && <div className="error" role="alert"><XCircle size={16}/>{error}</div>}
    </section>

    <section id="engine" className="loop">
      <div className="sectionhead"><span>THE INTELLIGENCE LOOP</span><h2>One closed loop from signal to outcome.</h2></div>
      <div className="steps">{steps.map(([n,t,d],i)=><div className={"step "+(result&&i<5?"active":"")} key={n}><div className="num">{n}</div><div className="stepicon">{i===0?<CircleDot size={18}/>:i===1?<Target size={18}/>:i===2?<Sparkles size={18}/>:i===3?<BrainCircuit size={18}/>:i===4?<Zap size={18}/>:<CheckCircle2 size={18}/>}</div><h3>{t}</h3><p>{d}</p></div>)}</div>
    </section>

    <section id="architecture" className="architecture">
      <div className="sectionhead"><span>CORE ARCHITECTURE</span><h2>The intelligence layer<br/>behind every product.</h2></div>
      <div className="archgrid">
        <div className="corecard"><div className="orb"><BrainCircuit size={42}/></div><span className="tag">AI CORE</span><h3>Decision intelligence</h3><p>Structured reasoning over context, evidence, constraints and objectives. The output is not just text. It is an executable decision contract.</p><div className="chips"><span>Context</span><span>Reasoning</span><span>Confidence</span><span>Evidence</span><span>Priority</span><span>Policy</span></div></div>
        <div className="layers">{capabilities.map(([x,d,t],i)=><div className="layer" key={x}><b>{String(i+1).padStart(2,"0")}</b><div><strong>{x}</strong><small>{d}</small></div><span className="layerTag">{t}</span><ChevronRight size={15}/></div>)}</div>
      </div>
    </section>

    <section id="control" className="control">
      <div className="sectionhead"><span>DECISION CONTROL CENTER</span><h2>AI autonomy without<br/><em>blind autonomy.</em></h2></div>
      <div className="controlgrid">
        <article><div className="controlicon"><Bot size={20}/></div><span>01 · REASON</span><h3>AI proposes</h3><p>Every recommendation carries evidence, confidence, priority, objective and target KPI.</p></article>
        <article><div className="controlicon"><LockKeyhole size={20}/></div><span>02 · GOVERN</span><h3>Human approves</h3><p>High-impact actions stop at an explicit approval gate before tools can execute them.</p></article>
        <article><div className="controlicon"><Terminal size={20}/></div><span>03 · ACT</span><h3>Tools execute</h3><p>Approved missions move through controlled execution states with traceable actions.</p></article>
        <article><div className="controlicon"><RefreshCw size={20}/></div><span>04 · LEARN</span><h3>Outcomes teach</h3><p>Measured results become structured learning signals for future decisions.</p></article>
      </div>
    </section>

    <section id="products" className="products">
      <div className="sectionhead"><span>PRODUCT ECOSYSTEM</span><h2>Build once. Apply everywhere.</h2></div>
      <div className="productgrid">{[["GROWTH ADVISOR","Business growth OS","Diagnose growth constraints and create measurable missions."],["WEBSITE BUILDER","Active business surface","Turn websites into continuously optimized growth assets."],["INVESTOR INTELLIGENCE","Opportunity analysis","Screen markets, companies, scenarios and risk with the same decision layer."],["VERTICAL AGENTS","Specialized intelligence","Sales, hospitality, marketing, e-commerce and operations agents."]].map(([a,b,c])=><article key={a}><span>{a}</span><h3>{b}</h3><p>{c}</p><ArrowRight size={18}/></article>)}</div>
    </section>

    <section className="quality">
      <div><span className="tag">PRODUCTION CONTROL</span><h2>Intelligence with<br/><em>guardrails.</em></h2><p>Every high-impact action is designed to pass through authorization, approval policy, tool permissions, execution state, auditability and outcome measurement.</p><div className="security"><div><ShieldCheck size={21}/><span>Least privilege</span></div><div><LockKeyhole size={21}/><span>Approval gates</span></div><div><CheckCircle2 size={21}/><span>Audit trail</span></div></div></div>
      <div className="metrics"><div><span>Architecture layers</span><strong>08</strong></div><div><span>Mission states</span><strong>12</strong></div><div><span>Control principle</span><strong>HUMAN-IN-LOOP</strong></div><div><span>Runtime</span><strong>READY</strong></div></div>
    </section>

    <footer><div className="brand"><span className="mark"><BrainCircuit size={17}/></span><span>CORE ENGINE</span></div><span>AI Decision & Execution Infrastructure</span><span>© 2026</span></footer>
  </main>
}