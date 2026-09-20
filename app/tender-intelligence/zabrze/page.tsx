"use client";
import "./tender.css";
import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, CircleAlert, FileText, Gauge, Layers3, ShieldAlert, Sparkles, Target, Zap } from "lucide-react";
import { documents, questions, requirements, tenderFacts, type Priority } from "@/app/tender-intelligence/zabrze/data";

const tabs = ["Executive", "Requirements", "Questions", "Documents"] as const;
type Tab = typeof tabs[number];

export default function TenderIntelligence() {
  const [tab, setTab] = useState<Tab>("Executive");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [expanded, setExpanded] = useState<string | null>("Q-P1-01");

  const filtered = useMemo(() => priority === "ALL" ? questions : questions.filter(q => q.priority === priority), [priority]);
  const confirmed = requirements.filter(r => r.status === "CONFIRMED").length;
  const verify = requirements.filter(r => r.status === "REQUIRES_VERIFICATION").length;

  return <main className="tender-shell">
    <header className="tender-nav">
      <a href="/" className="ti-brand"><span className="ti-orb"><Sparkles size={16}/></span><span>CORE ENGINE <i>/ TENDER INTELLIGENCE</i></span></a>
      <div className="ti-navmeta"><span className="live-dot"/> LIVE CASE · ZABRZE 2026</div>
      <a className="backlink" href="/">Core Engine <ArrowUpRight size={14}/></a>
    </header>

    <section className="tender-hero">
      <div className="hero-copy">
        <div className="ti-eyebrow"><span/> PROCUREMENT INTELLIGENCE · CASE Z154/68879</div>
        <h1>From tender<br/><em>to bid intelligence.</em></h1>
        <p>AI command center for requirement extraction, cross-document risk detection, pricing questions and bid readiness. Built on the Core Engine mission architecture.</p>
        <div className="hero-actions">
          <button onClick={() => setTab("Questions")}><Zap size={15}/> Open P1/P2/P3 question pack</button>
          <a href={tenderFacts.sourceUrl} target="_blank" rel="noreferrer">Official procurement page <ArrowUpRight size={14}/></a>
        </div>
      </div>
      <div className="case-card">
        <div className="case-top"><span className="case-label">ACTIVE PROCUREMENT</span><span className="case-state">ANALYSIS LIVE</span></div>
        <h2>Zabrze · municipal waste</h2>
        <p>{tenderFacts.reference} · {tenderFacts.cpv}</p>
        <div className="case-grid">
          <div><small>DEADLINE</small><b>12 OCT · 09:00</b></div>
          <div><small>WADIUM</small><b>4.0M PLN</b></div>
          <div><small>DURATION</small><b>36 MONTHS</b></div>
          <div><small>SCORING</small><b>70 / 30</b></div>
        </div>
        <div className="confidence"><span>Evidence coverage</span><b>{confirmed} confirmed</b><i>{verify} require document verification</i></div>
      </div>
    </section>

    <section className="ti-dashboard">
      <div className="signal-strip">
        <div><span>BUYER</span><b>Miasto Zabrze</b></div><div><span>SUBMISSION</span><b>12.10.2026 · 09:00</b></div><div><span>BINDING</span><b>08.02.2027</b></div><div><span>QUESTIONS</span><b>12 drafted</b></div>
      </div>
      <nav className="ti-tabs">{tabs.map(t => <button key={t} onClick={() => setTab(t)} className={tab===t ? "active":""}>{t}</button>)}</nav>

      {tab === "Executive" && <div className="exec-grid">
        <article className="intel-card main-brief"><div className="card-kicker"><Gauge size={14}/> EXECUTIVE BRIEF</div><h2>The bid is not a price exercise. It is a cost-risk-quality system.</h2><p>The public notice confirms the core commercial frame: 36-month service, PLN 4m bid security, 70% price and 30% recycling-level criterion. The largest unresolved pricing variables sit inside the unparsed SWZ, OPZ, PPU, XLS and ZIP attachments.</p><div className="brief-lines"><div><CheckCircle2/> <span>Confirmed from public notice</span></div><div><CircleAlert/> <span>Document-level verification required before final bid</span></div><div><ShieldAlert/> <span>Recycling commitment creates economic and contractual exposure</span></div></div></article>
        <article className="intel-card"><div className="card-kicker"><Target size={14}/> DECISION GATES</div>{[["01","CAN WE PRICE IT?","Volumes + units + route assumptions"],["02","CAN WE DELIVER IT?","Fleet + people + treatment capacity"],["03","CAN WE DEFEND IT?","Recycling + evidence + penalties"],["04","CAN WE SUBMIT IT?","Formal documents + signatures + platform"]].map(x=><div className="gate" key={x[0]}><b>{x[0]}</b><div><strong>{x[1]}</strong><small>{x[2]}</small></div></div>)}</article>
        <article className="intel-card wide"><div className="card-kicker"><Layers3 size={14}/> REQUIREMENT HEATMAP</div><div className="heatmap"><div className="heat green"><b>{confirmed}</b><span>confirmed</span></div><div className="heat amber"><b>{requirements.filter(r=>r.status==="PARTIAL").length}</b><span>partial</span></div><div className="heat red"><b>{verify}</b><span>verify</span></div><div className="heat violet"><b>{questions.filter(q=>q.priority==="P1").length}</b><span>P1 questions</span></div></div></article>
        <article className="intel-card wide"><div className="card-kicker"><Sparkles size={14}/> ENGINE NEXT ACTION</div><div className="next-stage"><div><small>STAGE A–I · CURRENT</small><h3>Parse the actual procurement documents, then re-score every requirement.</h3><p>The landing page deliberately separates verified facts from hypotheses. Once SWZ/OPZ/PPU/XLS/ZIP content is machine-readable, Core Engine can run the full cross-document contradiction and pricing-impact pass.</p></div><span>DOCUMENT<br/>INTAKE <ArrowUpRight/></span></div></article>
      </div>}

      {tab === "Requirements" && <div className="table-wrap"><div className="table-head"><div><span className="card-kicker"><FileText size={14}/> REAL REQUIREMENT MATRIX</span><h2>What is known, what is missing, what changes the bid.</h2></div><div className="legend"><span className="l-green">CONFIRMED</span><span className="l-amber">PARTIAL</span><span className="l-red">VERIFY</span></div></div><div className="req-table">{requirements.map(r=><div className="req-row" key={r.id}><span className="req-id">{r.id}</span><div><b>{r.area} · {r.requirement}</b><p>{r.evidence}</p></div><span className={"status "+r.status.toLowerCase()}>{r.status}</span><div className="impact"><small>IMPACT</small><span>{r.impact}</span></div><div className="action"><small>NEXT</small><span>{r.action}</span></div></div>)}</div></div>}

      {tab === "Questions" && <div className="question-board"><div className="q-sidebar"><div className="card-kicker"><ShieldAlert size={14}/> BUYER QUESTIONS</div><h2>Only questions that can change the bid.</h2><p>Prioritized by pricing, operational and contractual consequence.</p><div className="q-filters">{(["ALL","P1","P2","P3"] as const).map(p=><button className={priority===p?"active":""} onClick={()=>setPriority(p)} key={p}>{p}<span>{p==="ALL"?questions.length:questions.filter(q=>q.priority===p).length}</span></button>)}</div></div><div className="q-list">{filtered.map(q=><article className={"q-item "+q.priority.toLowerCase()} key={q.id} onClick={()=>setExpanded(expanded===q.id?null:q.id)}><div className="q-summary"><span className="priority">{q.priority}</span><div><small>{q.id} · {q.area}</small><h3>{q.issue}</h3></div><span className="q-impact">{q.pricingImpact}</span></div>{expanded===q.id&&<div className="q-detail"><div className="rationale"><small>WHY THIS MATTERS</small><p>{q.rationale}</p></div><div><small>PROPOSED QUESTION TO BUYER</small><blockquote>{q.question}</blockquote></div><div className="q-evidence"><small>EVIDENCE / SOURCE STATUS</small><span>{q.evidence}</span></div></div>}</article>)}</div></div>}

      {tab === "Documents" && <div className="doc-board"><div className="doc-intro"><span className="card-kicker"><FileText size={14}/> DOCUMENT CONTROL</span><h2>Source before inference.</h2><p>Every item is explicitly marked so the engine cannot present an unparsed document as verified evidence.</p></div><div className="doc-list">{documents.map(d=><div className="doc-row" key={d[0]}><span>{d[0]}</span><FileText size={16}/><div><b>{d[1]}</b><small>{d[2]}</small></div><strong className={d[3]}>{d[3]==="readable"?"READ / VERIFIED":"LISTED · "+d[3].toUpperCase()}</strong></div>)}</div></div>}
    </section>
    <footer className="ti-footer"><span>CORE ENGINE · TENDER INTELLIGENCE</span><span>Evidence → Risk → Question → Decision → Mission</span><span>2026</span></footer>
  </main>;
}
