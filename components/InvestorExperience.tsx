"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, BarChart3, BrainCircuit, Check, ChevronRight, CircleDot, Crosshair, Database, Gauge, GitBranch, Layers3, LockKeyhole, Play, Radar, RefreshCw, Rocket, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import type { EngineResponse, MissionActionResponse } from "@/lib/api-contracts";

type CoreResponse = EngineResponse & {
  context?: { domain?: string; [key: string]: unknown };
  evidence?: Array<{ id?: string; claim?: string; source?: string; [key: string]: unknown }>;
  evidenceQuality?: { score?: number; [key: string]: unknown };
  evidenceGraph?: unknown;
  growthMission?: { selectedPacks?: Array<{ id?: string; name?: string }>; actions?: Array<{ id?: string; name?: string; risk?: string; requiresApproval?: boolean }>; [key: string]: unknown };
  audit?: { algorithm?: string; integrity?: string; chainLength?: number; head?: string; chain?: Array<{ stage?: string; hash?: string; [key: string]: unknown }> };
};

type Runtime = {
  ok?: boolean;
  engine?: string;
  version?: string;
  status?: string;
  capabilities?: string[];
  capabilityPacks?: Array<{ id: string; name: string; category: string; version: string; capabilities: string[]; actions: Array<{ id: string; name: string; risk: string; requiresApproval: boolean }> }>;
  readiness?: Record<string, unknown>;
  mt5?: Record<string, unknown>;
  resilience?: Record<string, unknown>;
  security?: Record<string, unknown>;
  stageManifest?: Record<string, unknown>;
};

const scenarios = {
  Growth: [
    { name: "conversion_rate", value: "2.8%", source: "analytics" },
    { name: "traffic", value: "+18%", source: "analytics" },
    { name: "checkout_dropoff", value: "41%", source: "funnel" },
  ],
  Sales: [
    { name: "qualified_leads", value: "-14%", source: "CRM" },
    { name: "response_time", value: "11h", source: "CRM" },
    { name: "win_rate", value: "18%", source: "sales" },
  ],
  Operations: [
    { name: "order_backlog", value: "+27%", source: "operations" },
    { name: "cycle_time", value: "3.4d", source: "ERP" },
    { name: "capacity", value: "82%", source: "workforce" },
  ],
} as const;

type Scenario = keyof typeof scenarios;

const products = [
  ["01", "Bet Builder", "DECISION INTELLIGENCE", "Live sports data, research, evidence and governed decisions.", "orange", Target],
  ["02", "Growth Advisor", "BUSINESS OPERATING SYSTEM", "Business signals, opportunity detection, Growth Mission and outcome learning.", "violet", Gauge],
  ["03", "Extra Szpieg", "OPPORTUNITY INTELLIGENCE", "Marketplace scanning, provenance, evidence and user-controlled actions.", "green", Radar],
] as const;

const roadmap = [
  ["01", "CORE", "Reusable intelligence primitives"],
  ["02", "PRODUCTS", "Vertical applications on one core"],
  ["03", "DATA", "Connectors, evidence and context"],
  ["04", "AUTONOMY", "Governed execution"],
  ["05", "LEARNING", "Outcome feedback"],
  ["06", "PLATFORM", "Multi-tenant SaaS and enterprise control"],
] as const;

const flow = ["OBSERVE", "CONTEXT", "EVIDENCE", "DIAGNOSE", "PRIORITIZE", "DECIDE", "MISSION", "APPROVAL", "EXECUTE", "MEASURE", "LEARN"];

function pct(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default function InvestorExperience() {
  const [scenario, setScenario] = useState<Scenario>("Growth");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CoreResponse | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);

  useEffect(() => {
    fetch("/api/engine", { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((data) => setRuntime(data))
      .catch(() => setRuntime(null));
  }, []);

  async function run() {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ signals: scenarios[scenario], domain: scenario.toLowerCase() }),
      });
      const data = await response.json();
      setResult(data);
      if (!response.ok) throw new Error(data.error || "ENGINE_REQUEST_FAILED");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ENGINE_REQUEST_FAILED");
    } finally {
      setRunning(false);
    }
  }

  async function missionAction(action: string) {
    if (!result?.mission?.id) return;
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: result.mission.id, action, idempotencyKey: crypto.randomUUID() }),
      });
      const data = (await response.json()) as MissionActionResponse;
      if (!response.ok) throw new Error(data.error || "MISSION_OPERATION_FAILED");
      setResult((current) => current ? { ...current, mission: data.mission, state: data.mission?.state, trace: data.trace ?? current.trace } : current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "MISSION_OPERATION_FAILED");
    } finally {
      setBusy("");
    }
  }

  const next = useMemo(() => {
    const state = result?.mission?.state;
    return state === "AWAITING_APPROVAL" ? "approve" : state === "APPROVED" ? "execute" : state === "EXECUTING" ? "measure" : state === "MEASURING" ? "complete" : state === "COMPLETED" ? "learn" : state === "FAILED" ? "retry" : "";
  }, [result]);

  const currentStage = result?.mission?.state;
  const evidenceQuality = result?.evidenceQuality?.score;
  const capabilities = runtime?.capabilities?.length ?? 0;
  const packs = runtime?.capabilityPacks?.length ?? 0;

  return (
    <main>
      <nav>
        <a className="brand" href="#top"><span className="mark"><BrainCircuit size={18} /></span><span>CORE ENGINE AI</span></a>
        <div className="navlinks"><a href="#engine">Live Engine</a><a href="#architecture">Architecture</a><a href="#portfolio">Products</a><a href="#roadmap">Roadmap</a></div>
        <a className="navbtn" href="#engine">Run the core <ArrowRight size={14} /></a>
      </nav>

      <section id="top" className="investorHero">
        <div className="heroVisual" aria-hidden="true"><div className="signalRing ringOne" /><div className="signalRing ringTwo" /><div className="signalCore"><BrainCircuit size={58} /></div><span className="shard shardOne" /><span className="shard shardTwo" /><span className="shard shardThree" /></div>
        <div className="heroCopy">
          <div className="eyebrow"><span className="pulse" />AI BUSINESS OPERATING SYSTEM<span className="line" /></div>
          <div className="investorBadge"><CircleDot size={11} /> INVESTOR EXPERIENCE · LIVE CORE</div>
          <h1>One intelligence core.<br /><em>Many businesses.</em></h1>
          <p className="lead">A governed intelligence layer that turns signals into evidence, decisions, missions, measurable outcomes and reusable learning.</p>
          <div className="actions"><a className="primary" href="#engine"><Play size={15} /> Experience the core</a><a className="secondary" href="#architecture">Inspect the architecture <ChevronRight size={15} /></a></div>
          <div className="heroProof"><span><ShieldCheck size={14} /> Evidence-first</span><span><LockKeyhole size={14} /> Human approval</span><span><BarChart3 size={14} /> Outcome learning</span></div>
        </div>
      </section>

      <section className="investorStatement" id="investor">
        <div><span className="tag">THE PLATFORM THESIS</span><h2>Build intelligence once.<br />Deploy it across decision environments.</h2></div>
        <div className="statementGrid"><article><span>01</span><h3>Reusable Core</h3><p>Context, evidence, decision, mission, policy, execution and learning remain shared infrastructure.</p></article><article><span>02</span><h3>Vertical Proof</h3><p>Bet Builder, Growth Advisor and Extra Szpieg exercise the same control plane against different problems.</p></article><article><span>03</span><h3>Compounding Learning</h3><p>Measured outcomes return to the intelligence loop instead of disappearing after execution.</p></article></div>
      </section>

      <section id="engine" className="loop investorSection">
        <div className="sectionhead"><span>LIVE INTELLIGENCE CORE</span><h2>See the actual engine work.</h2><p className="sectionLead">The demo exposes the real response: context, evidence quality, decision matrix, risk gate, mission, audit chain and capability planning.</p></div>
        <div className="demo-bar">
          <div className="demo-copy"><span className="tag">INPUT</span><b>Choose an operating domain</b><small>The same intelligence core receives a different signal set.</small></div>
          <div className="scenario-tabs">{(Object.keys(scenarios) as Scenario[]).map((item) => <button key={item} className={scenario === item ? "selected" : ""} onClick={() => setScenario(item)} aria-pressed={scenario === item}><Activity size={13} /> {item}</button>)}</div>
          <div className="signal-pills">{scenarios[scenario].map((signal) => <span key={signal.name}><b>{signal.name}</b>{signal.value}<i>{signal.source}</i></span>)}</div>
        </div>
        <div className="demoControl"><button className="primary" onClick={run} disabled={running}>{running ? <Sparkles size={15} className="spin" /> : <Zap size={15} />}{running ? "CORE IS REASONING" : "RUN LIVE INTELLIGENCE"}</button><div className="status"><span className="dot" /> {runtime?.status || "CORE CONNECTING"} <span>•</span> v{runtime?.version || "1.x"} <span>•</span> {capabilities} capabilities <span>•</span> {packs} packs</div></div>

        {result && <div className="coreTelemetry">
          <div className="telemetryHeader"><div><span className="tag">CORE TELEMETRY</span><h3>{result.engine} · v{result.version}</h3></div><div className="telemetryState"><span className="dot" /> {result.state}</div></div>
          <div className="telemetryGrid">
            <div className="telemetryCard"><small>CONTEXT</small><strong>{result.context?.domain || scenario}</strong><span>{result.evidence?.length || 0} evidence nodes</span></div>
            <div className="telemetryCard"><small>EVIDENCE QUALITY</small><strong>{typeof evidenceQuality === "number" ? `${evidenceQuality}/100` : "N/A"}</strong><span>graph + provenance processed</span></div>
            <div className="telemetryCard"><small>LEARNING</small><strong>{result.learning?.applied ?? 0}</strong><span>prior lessons applied</span></div>
            <div className="telemetryCard"><small>AUDIT</small><strong>{result.audit?.chainLength ?? 0} events</strong><span>{result.audit?.integrity || "UNSIGNED"}</span></div>
          </div>
          <div className="engineFlow">{flow.map((stage, index) => <div key={stage} className={result.trace?.some((t) => t.stage === stage) ? "flowNode active" : "flowNode"}><span>{String(index + 1).padStart(2, "0")}</span><b>{stage}</b>{index < flow.length - 1 && <ArrowDownRight size={13} />}</div>)}</div>
        </div>}

        {result?.decision && result.mission && <section className="decision investorDecision" aria-live="polite">
          <div className="decisiontop"><span className="tag">DECISION CENTER</span><span className={"approved " + String(result.mission.state).toLowerCase()}>{result.mission.state}</span></div>
          <h3>{result.decision.recommendation}</h3><p>{result.decision.diagnosis}</p>
          <div className="decisiongrid"><div><small>CONFIDENCE</small><b>{pct(result.decision.confidence)}%</b></div><div><small>PRIORITY</small><b>{result.decision.priority}</b></div><div><small>REASONING</small><b>{result.decision.reasoningSource}</b></div><div><small>RISK GATE</small><b>{result.decision.riskGate || "PASS"}</b></div></div>
          <div className="evidence"><span>Evidence</span>{(result.decision.evidence || []).slice(0, 8).map((item) => <code key={item}>{item}</code>)}</div>
          <div className="trace">{(result.trace || []).map((step, index) => <span key={step.stage + index} className={step.status === "COMPLETE" || step.status === "CREATED" ? "current" : ""}>{step.stage} · {step.status}</span>)}</div>
          <div className="missionbar"><div><span>MISSION</span><b>{result.mission.objective}</b></div><button className="nextaction" disabled={!next || !!busy} onClick={() => missionAction(next)}>{busy ? <Sparkles size={14} className="spin" /> : <ArrowRight size={14} />}{busy ? "PROCESSING" : next ? next.toUpperCase() : "MISSION COMPLETE"}</button></div>
        </section>}

        {result?.audit && <div className="auditPanel"><div><span className="tag">PROVENANCE</span><h3>Cryptographic audit chain</h3><p>{result.audit.algorithm}</p></div><div className="auditStats"><strong>{result.audit.chainLength}</strong><span>CHAIN EVENTS</span><strong>{result.audit.integrity}</strong><span>INTEGRITY</span></div><code className="auditHead">HEAD · {result.audit.head || "N/A"}</code></div>}
        {result?.growthMission && <div className="capabilityPanel"><div><span className="tag">CAPABILITY FABRIC</span><h3>Mission plan generated by the core</h3><p>{result.growthMission.selectedPacks?.length || 0} capability packs · {result.growthMission.actions?.length || 0} planned actions</p></div><div className="capabilityList">{(result.growthMission.actions || []).slice(0, 8).map((action) => <span key={action.id || action.name}><Check size={12} /> {action.name || action.id} · {action.risk || "CONTROLLED"}{action.requiresApproval ? " · APPROVAL" : ""}</span>)}</div></div>}
        {error && <div className="error"><span>CORE ERROR</span>{error}</div>}
      </section>

      <section id="architecture" className="architecture investorSection">
        <div className="sectionhead"><span>CONTROL PLANE</span><h2>The system underneath every product.</h2><p className="sectionLead">The engine already exposes context, evidence graphs, deterministic gates, capability packs, audit, resilience and learning surfaces. The investor UI now exposes those layers instead of hiding them.</p></div>
        <div className="archgrid"><div className="corecard investorCore"><div className="orb"><BrainCircuit size={40} /></div><span className="tag">CORE INTELLIGENCE</span><h3>Decision → Mission → Outcome</h3><p>One stateful control plane for reasoning, evidence, governance, execution and feedback.</p><div className="chips">{["Context", "Evidence Graph", "Decision Matrix", "Risk Gate", "Mission", "Capabilities", "Audit", "Learning"].map((item) => <span key={item}>{item}</span>)}</div></div><div className="layers">{[["01", "Context Engine", "Normalizes operating signals"],["02", "Evidence Fabric", "Claims, provenance and graph"],["03", "Decision Center", "Diagnosis, priority and recommendation"],["04", "Risk + Policy", "Fail-closed governance"],["05", "Mission Engine", "Typed state transitions"],["06", "Capability Fabric", "Approved actions and execution"],["07", "Outcome + Learning", "Measurement becomes future context"]].map(([number, title, description]) => <div className="layer" key={title}><b>{number}</b><div><strong>{title}</strong><small>{description}</small></div><ChevronRight size={15} /></div>)}</div></div>
      </section>

      <section className="control investorSection"><div className="sectionhead"><span>GOVERNED AUTONOMY</span><h2>Autonomy stays inside explicit control boundaries.</h2></div><div className="controlgrid"><article><div className="controlicon"><BrainCircuit size={19} /></div><span>REASON</span><h3>AI proposes</h3><p>Signals become structured diagnosis and evidence-backed recommendations.</p></article><article><div className="controlicon"><LockKeyhole size={19} /></div><span>GOVERN</span><h3>Human approves</h3><p>Consequential capability actions remain behind approval policy.</p></article><article><div className="controlicon"><Crosshair size={19} /></div><span>ACT</span><h3>Tools execute</h3><p>Execution is idempotent, stateful and recorded in the mission lifecycle.</p></article><article><div className="controlicon"><BarChart3 size={19} /></div><span>LEARN</span><h3>Outcomes teach</h3><p>Verified outcomes become lessons for future intelligence runs.</p></article></div></section>

      <section id="portfolio" className="products investorSection"><div className="sectionhead"><span>PRODUCT PORTFOLIO</span><h2>Three products. One control plane.</h2><p className="sectionLead">Different domains provide different validation environments for the same intelligence architecture.</p></div><div className="portfolioGrid">{products.map(([id, name, type, description, accent, Icon]) => <article className={`portfolioCard ${accent}`} key={name}><div className="portfolioTop"><span>{id}</span><b>CORE SURFACE</b></div><div className="portfolioIcon"><Icon size={25} /></div><span className="portfolioType">{type}</span><h3>{name}</h3><p>{description}</p><div className="portfolioMetrics"><span>Context</span><span>Evidence</span><span>Decision</span><span>Mission</span><span>Learning</span></div><a href="#engine">Run through the core <ArrowRight size={14} /></a></article>)}</div></section>

      <section id="roadmap" className="programfield investorSection"><div className="sectionhead"><span>PLATFORM ROADMAP</span><h2>From working intelligence core to scalable platform.</h2></div><div className="roadmapGrid">{roadmap.map(([number, title, description]) => <article className="roadmapCard" key={number}><span>{number}</span><GitBranch size={18} /><h3>{title}</h3><p>{description}</p><div className="roadmapLine" /></article>)}</div></section>

      <section className="quality investorSection"><div><span className="tag">RUNTIME SIGNALS</span><h2>The landing page itself now exposes the system it represents.</h2><p>Runtime readiness, security, resilience, capability packs, audit integrity and stage manifests are treated as product telemetry instead of hidden implementation details.</p><div className="security"><div><Database size={15} /> {runtime?.status || "CONNECTING"}</div><div><ShieldCheck size={15} /> {runtime?.security ? "SECURITY ACTIVE" : "SECURITY UNKNOWN"}</div><div><Layers3 size={15} /> {packs} CAPABILITY PACKS</div><div><RefreshCw size={15} /> RESILIENCE SURFACE</div></div></div><div className="metrics"><div><span>Engine version</span><strong>{runtime?.version || "..."}</strong></div><div><span>Capabilities</span><strong>{capabilities}</strong></div><div><span>Current mission</span><strong>{currentStage || "READY"}</strong></div><div><span>Audit head</span><strong>{result?.audit?.head ? result.audit.head.slice(0, 10) : "READY"}</strong></div></div></section>

      <section className="finalInvestor"><span className="tag">INVESTOR EXPERIENCE</span><h2>One core.<br /><em>Multiple paths to value.</em></h2><p>Run the intelligence loop. Inspect the evidence. See the mission. Cross the approval gate. Measure the outcome.</p><a className="primary" href="#engine"><Rocket size={15} /> Run the Core Engine</a></section>

      <footer><div className="brand"><span className="mark"><BrainCircuit size={17} /></span><span>CORE ENGINE AI</span></div><span>Decision intelligence infrastructure for business</span><span>Live Investor Experience · 2026</span></footer>
    </main>
  );
}
