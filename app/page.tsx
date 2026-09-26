"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Crosshair,
  ExternalLink,
  Gauge,
  GitBranch,
  Layers3,
  LockKeyhole,
  Play,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import type { EngineResponse, MissionActionResponse, TraceStep } from "@/lib/api-contracts";

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
  {
    id: "01",
    name: "Bet Builder",
    type: "DECISION INTELLIGENCE",
    description:
      "A domain application showing the Core Engine pattern against live sports data, research, evidence and governed decision flows.",
    accent: "orange",
    status: "ACTIVE BUILD",
    metrics: ["Events", "Research", "Evidence", "Decision", "Mission"],
    href: "#portfolio",
  },
  {
    id: "02",
    name: "Growth Advisor",
    type: "BUSINESS OPERATING SYSTEM",
    description:
      "The commercial application layer: website audit, opportunity detection, Growth Mission, approval and outcome learning.",
    accent: "violet",
    status: "CORE PRODUCT",
    metrics: ["Audit", "Trust Gate", "Mission", "Execution", "Learning"],
    href: "#portfolio",
  },
  {
    id: "03",
    name: "Extra Szpieg",
    type: "OPPORTUNITY INTELLIGENCE",
    description:
      "Marketplace intelligence for finding, evaluating and monitoring opportunities with provenance, evidence and user-controlled actions.",
    accent: "green",
    status: "PRODUCT LAB",
    metrics: ["Scan", "Evidence", "BUY", "WATCH", "PASS"],
    href: "#portfolio",
  },
];

const roadmap = [
  ["01", "CORE", "Reusable decision and mission primitives"],
  ["02", "PRODUCTS", "Vertical applications on one intelligence layer"],
  ["03", "DATA", "Connectors, evidence and persistent context"],
  ["04", "AUTONOMY", "Governed execution with explicit approval boundaries"],
  ["05", "LEARNING", "Outcome feedback improves future decisions"],
  ["06", "PLATFORM", "Multi-tenant SaaS, subscriptions and enterprise control"],
];

export default function Home() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EngineResponse | null>(null);
  const [scenario, setScenario] = useState<Scenario>("Growth");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ signals: scenarios[scenario] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Engine request failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Engine request failed");
    } finally {
      setRunning(false);
    }
  }

  async function action(actionName: string) {
    if (!result?.mission?.id) return;
    setBusy(actionName);
    setError("");
    try {
      const response = await fetch("/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          id: result.mission.id,
          action: actionName,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = (await response.json()) as MissionActionResponse;
      if (!response.ok) throw new Error(data.error || "Mission action failed");
      setResult((current) =>
        current
          ? {
              ...current,
              mission: data.mission,
              state: data.mission?.state,
              trace: data.trace ?? current.trace,
            }
          : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mission action failed");
    } finally {
      setBusy("");
    }
  }

  const next =
    result?.mission?.state === "AWAITING_APPROVAL"
      ? "approve"
      : result?.mission?.state === "APPROVED"
        ? "execute"
        : result?.mission?.state === "EXECUTING"
          ? "measure"
          : result?.mission?.state === "MEASURING"
            ? "complete"
            : result?.mission?.state === "COMPLETED"
              ? "learn"
              : result?.mission?.state === "FAILED"
                ? "retry"
                : "";

  return (
    <main>
      <nav>
        <a className="brand" href="#top" aria-label="Core Engine home">
          <span className="mark"><BrainCircuit size={18} /></span>
          <span>CORE ENGINE AI</span>
        </a>
        <div className="navlinks">
          <a href="#engine">Live Demo</a>
          <a href="#architecture">Core</a>
          <a href="#portfolio">Portfolio</a>
          <a href="#roadmap">Roadmap</a>
        </div>
        <a className="navbtn" href="#investor">
          Investor view <ArrowRight size={14} />
        </a>
      </nav>

      <section id="top" className="investorHero">
        <div className="heroVisual" aria-hidden="true">
          <div className="signalRing ringOne" />
          <div className="signalRing ringTwo" />
          <div className="signalCore"><BrainCircuit size={58} /></div>
          <span className="shard shardOne" />
          <span className="shard shardTwo" />
          <span className="shard shardThree" />
        </div>

        <div className="heroCopy">
          <div className="eyebrow">
            <span className="pulse" />
            AI BUSINESS OPERATING SYSTEM
            <span className="line" />
          </div>
          <div className="investorBadge"><CircleDot size={11} /> INVESTOR EXPERIENCE · 2026</div>
          <h1>One intelligence core.<br /><em>Many businesses.</em></h1>
          <p className="lead">
            Core Engine turns business signals into evidence-backed decisions, governed missions,
            measurable outcomes and reusable learning.
          </p>
          <div className="actions">
            <a className="primary" href="#engine"><Play size={15} /> Experience the live engine</a>
            <a className="secondary" href="#portfolio">Explore the product system <ChevronRight size={15} /></a>
          </div>
          <div className="heroProof">
            <span><ShieldCheck size={14} /> Human approval boundary</span>
            <span><Activity size={14} /> Observable state machine</span>
            <span><BarChart3 size={14} /> Outcome feedback loop</span>
          </div>
        </div>
      </section>

      <section className="investorStatement" id="investor">
        <div>
          <span className="tag">THE INVESTMENT THESIS</span>
          <h2>Build the intelligence layer once.<br />Deploy it across verticals.</h2>
        </div>
        <div className="statementGrid">
          <article><span>01</span><h3>Reusable Core</h3><p>Decision, evidence, mission, policy and learning primitives stay independent from any single vertical.</p></article>
          <article><span>02</span><h3>Product Surface</h3><p>Each application becomes a focused interface over the same reasoning and execution infrastructure.</p></article>
          <article><span>03</span><h3>Compounding Data</h3><p>Every measured outcome creates structured feedback for future prioritization and decision quality.</p></article>
        </div>
      </section>

      <section id="engine" className="loop investorSection">
        <div className="sectionhead">
          <span>LIVE PRODUCT DEMO</span>
          <h2>Watch a signal become a governed mission.</h2>
          <p className="sectionLead">This is the real product surface, not a static mockup.</p>
        </div>

        <div className="demo-bar">
          <div className="demo-copy">
            <span className="tag">INPUT</span>
            <b>Select a business context</b>
            <small>Same intelligence core. Different operating domain.</small>
          </div>
          <div className="scenario-tabs">
            {(Object.keys(scenarios) as Scenario[]).map((item) => (
              <button
                key={item}
                className={scenario === item ? "selected" : ""}
                aria-pressed={scenario === item}
                onClick={() => setScenario(item)}
              >
                <Activity size={13} /> {item}
              </button>
            ))}
          </div>
          <div className="signal-pills">
            {scenarios[scenario].map((signal) => (
              <span key={signal.name}><b>{signal.name}</b>{signal.value}<i>{signal.source}</i></span>
            ))}
          </div>
        </div>

        <div className="demoControl">
          <button className="primary" onClick={run} disabled={running}>
            {running ? <Sparkles size={15} className="spin" /> : <Zap size={15} />}
            {running ? "Running intelligence loop" : "Run live intelligence demo"}
          </button>
          <div className="status"><span className="dot" /> {result ? "DECISION + MISSION LIVE" : "SYSTEM READY"} <span>•</span> fail-closed risk <span>•</span> human gate</div>
        </div>

        {result?.decision && result.mission && (
          <section className="decision investorDecision" aria-live="polite">
            <div className="decisiontop">
              <span className="tag">ENGINE OUTPUT</span>
              <span className={"approved " + String(result.mission.state).toLowerCase()}>{result.mission.state}</span>
            </div>
            <h3>{result.decision.recommendation}</h3>
            <p>{result.decision.diagnosis}</p>
            <div className="decisiongrid">
              <div><small>CONFIDENCE</small><b>{Math.round(result.decision.confidence * 100)}%</b></div>
              <div><small>PRIORITY</small><b>{result.decision.priority}</b></div>
              <div><small>SOURCE</small><b>{result.decision.reasoningSource}</b></div>
            </div>
            <div className="evidence"><span>Evidence</span>{result.decision.evidence.slice(0, 6).map((item) => <code key={item}>{item}</code>)}</div>
            <div className="trace">{(result.trace ?? []).map((step: TraceStep, index: number) => <span key={step.stage + index} className={index === (result.trace?.length ?? 1) - 1 ? "current" : ""}>{step.stage} · {step.status}</span>)}</div>
            <div className="missionbar">
              <div><span>MISSION</span><b>{result.mission.objective}</b></div>
              <button className="nextaction" disabled={!next || !!busy} onClick={() => action(next)}>
                {busy ? <Sparkles size={14} className="spin" /> : <ArrowRight size={14} />}
                {busy ? "PROCESSING" : next ? next.toUpperCase() : "MISSION COMPLETE"}
              </button>
            </div>
          </section>
        )}

        {error && <div className="error"><span>ENGINE ERROR</span>{error}</div>}

        <div className="steps investorSteps">
          {["OBSERVE", "DIAGNOSE", "PRIORITIZE", "DECIDE", "EXECUTE", "LEARN"].map((item, index) => (
            <div className={"step " + (result && index < 4 ? "active" : "")} key={item}>
              <div className="num">0{index + 1}</div>
              <Sparkles size={17} />
              <h3>{item}</h3>
              <p>{["Signals + context", "Problems + causes", "Impact + confidence", "Evidence + recommendation", "Approved boundary", "Measured outcome"][index]}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="architecture" className="architecture investorSection">
        <div className="sectionhead">
          <span>CORE ENGINE ARCHITECTURE</span>
          <h2>The operating system underneath the products.</h2>
          <p className="sectionLead">A shared control plane separates intelligence from vertical application logic.</p>
        </div>
        <div className="archgrid">
          <div className="corecard investorCore">
            <div className="orb"><BrainCircuit size={40} /></div>
            <span className="tag">CORE INTELLIGENCE</span>
            <h3>Decision → Mission → Outcome</h3>
            <p>Typed decisions. Evidence. Policy. Approval. Execution. Measurement. Learning.</p>
            <div className="chips">
              {["Context", "Reasoning", "Evidence", "Risk", "Policy", "Mission", "Outcome", "Learning"].map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="layers">
            {[
              ["01", "Context Engine", "Normalizes signals and operating context"],
              ["02", "Decision Center", "Produces evidence-backed recommendations"],
              ["03", "Mission Engine", "Turns approved decisions into stateful work"],
              ["04", "Approval Gate", "Keeps consequential actions explicitly governed"],
              ["05", "Execution Layer", "Connects approved missions to tools"],
              ["06", "Outcome Engine", "Measures results against intent"],
              ["07", "Learning System", "Feeds outcomes into future decisions"],
            ].map(([number, title, description]) => (
              <div className="layer" key={title}><b>{number}</b><div><strong>{title}</strong><small>{description}</small></div><ChevronRight size={15} /></div>
            ))}
          </div>
        </div>
      </section>

      <section id="portfolio" className="products investorSection">
        <div className="sectionhead">
          <span>PORTFOLIO APPLICATIONS</span>
          <h2>Three surfaces. One intelligence architecture.</h2>
          <p className="sectionLead">The portfolio demonstrates horizontal reuse across different decision environments.</p>
        </div>
        <div className="portfolioGrid">
          {products.map((product) => (
            <article className={"portfolioCard " + product.accent} key={product.name}>
              <div className="portfolioTop"><span>{product.id}</span><b>{product.status}</b></div>
              <div className="portfolioIcon">
                {product.name === "Bet Builder" ? <Target size={25} /> : product.name === "Growth Advisor" ? <Gauge size={25} /> : <Radar size={25} />}
              </div>
              <span className="portfolioType">{product.type}</span>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <div className="portfolioMetrics">{product.metrics.map((metric) => <span key={metric}>{metric}</span>)}</div>
              <a href={product.href}>View role in the system <ArrowRight size={14} /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="control investorSection">
        <div className="sectionhead">
          <span>GOVERNED AUTONOMY</span>
          <h2>Autonomy increases only inside explicit control boundaries.</h2>
        </div>
        <div className="controlgrid">
          {[
            ["REASON", "AI proposes", BrainCircuit],
            ["GOVERN", "Human approves", LockKeyhole],
            ["ACT", "Tools execute", Crosshair],
            ["LEARN", "Outcomes teach", BarChart3],
          ].map(([label, title, Icon]) => (
            <article key={label as string}>
              <div className="controlicon"><Icon size={19} /></div>
              <span>{label as string}</span>
              <h3>{title as string}</h3>
              <p>State, policy and evidence determine the next permitted transition.</p>
            </article>
          ))}
        </div>
      </section>

      <section id="roadmap" className="programfield investorSection">
        <div className="sectionhead">
          <span>ROADMAP · PLATFORM EVOLUTION</span>
          <h2>From working intelligence core to scalable AI platform.</h2>
        </div>
        <div className="roadmapGrid">
          {roadmap.map(([number, title, description]) => (
            <article className="roadmapCard" key={number}>
              <span>{number}</span>
              <GitBranch size={18} />
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="roadmapLine" />
            </article>
          ))}
        </div>
      </section>

      <section className="quality investorSection">
        <div>
          <span className="tag">WHY THIS ARCHITECTURE MATTERS</span>
          <h2>Reusable intelligence creates a larger product surface without duplicating the core.</h2>
          <p>
            The strategic asset is the control plane: structured reasoning, evidence, missions,
            approval boundaries and outcome learning. Vertical products become distribution and
            validation surfaces for the same underlying system.
          </p>
          <div className="security">
            <div><ShieldCheck size={15} /> Evidence-first</div>
            <div><LockKeyhole size={15} /> Human-gated</div>
            <div><Layers3 size={15} /> Modular</div>
            <div><Rocket size={15} /> Product-ready</div>
          </div>
        </div>
        <div className="metrics">
          <div><span>Intelligence core</span><strong>1</strong></div>
          <div><span>Product surfaces</span><strong>3</strong></div>
          <div><span>Control model</span><strong>GOVERNED</strong></div>
          <div><span>Architecture</span><strong>MODULAR</strong></div>
        </div>
      </section>

      <footer>
        <div className="brand"><span className="mark"><BrainCircuit size={17} /></span><span>CORE ENGINE AI</span></div>
        <span>Decision intelligence infrastructure for business</span>
        <span>Investor Experience · 2026</span>
      </footer>
    </main>
  );
}
