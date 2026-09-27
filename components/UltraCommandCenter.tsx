"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Circle, Database, Gauge, GitBranch, LockKeyhole, Play, Radar, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";

type Json = Record<string, any>;
const domains = {
  Growth: [{ name: "conversion_rate", value: "2.8%", source: "analytics" }, { name: "traffic", value: "+18%", source: "analytics" }, { name: "checkout_dropoff", value: "41%", source: "funnel" }],
  Sales: [{ name: "qualified_leads", value: "-14%", source: "CRM" }, { name: "response_time", value: "11h", source: "CRM" }, { name: "win_rate", value: "18%", source: "sales" }],
  Operations: [{ name: "order_backlog", value: "+27%", source: "operations" }, { name: "cycle_time", value: "3.4d", source: "ERP" }, { name: "capacity", value: "82%", source: "workforce" }],
} as const;
const stages = ["OBSERVE", "KONTEKST", "DOWODY", "DIAGNOSE", "DECIDE", "MISSION", "APPROVAL", "EXECUTE", "MEASURE", "LEARN"];

export default function UltraCommandCenter() {
  const [domain, setDomain] = useState<keyof typeof domains>("Growth");
  const [runtime, setRuntime] = useState<Json | null>(null);
  const [agent, setAgent] = useState<Json | null>(null);
  const [result, setResult] = useState<Json | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [missionBusy, setMissionBusy] = useState(false);
  const [commercial, setCommercial] = useState<Json | null>(null);
  const [agentQuestion, setAgentQuestion] = useState("");
  const [agentAnalysis, setAgentAnalysis] = useState<Json | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentError, setAgentError] = useState("");
  const agentPrompts = [
    "Our sales team gets plenty of leads, but response time is too slow and win rate is falling. What should we investigate?",
    "Traffic is growing, but checkout conversion is weak. Find the likely bottleneck and propose the first experiment.",
    "Our operations backlog keeps growing while the team is near capacity. What should we diagnose before hiring?",
    "Customer churn is increasing. How should we structure the investigation and decide what to change first?"
  ];

  useEffect(() => {
    Promise.all([
      fetch("/api/engine", { headers: { Accept: "application/json" } }).then(r => r.json()),
      fetch("/api/agent", { headers: { Accept: "application/json" } }).then(r => r.json()),
      fetch("/api/commercial", { headers: { Accept: "application/json" } }).then(r => r.json())
    ]).then(([engine, agentData, commercialData]) => { setRuntime(engine); setAgent(agentData); setCommercial(commercialData); }).catch(() => { setRuntime(null); setAgent(null); setCommercial(null); });
  }, []);

  const trace = result?.trace ?? [];
  const completed = useMemo(() => {
    const done = new Set(trace.filter((x: Json) => ["GOTOWE", "UTWORZONA", "PRZEJŚCIE"].includes(String(x.status).toUpperCase())).map((x: Json) => String(x.stage).toUpperCase().replace(/[^A-Z]/g, "")));
    if (result?.mission?.id) done.add("MISSION");
    if (["APPROVED", "EXECUTING", "MEASURING", "GOTOWED", "LEARNED"].includes(String(result?.mission?.state))) done.add("APPROVAL");
    if (["EXECUTING", "MEASURING", "GOTOWED", "LEARNED"].includes(String(result?.mission?.state))) done.add("EXECUTE");
    if (["MEASURING", "GOTOWED", "LEARNED"].includes(String(result?.mission?.state))) done.add("MEASURE");
    if (result?.mission?.state === "LEARNED") done.add("LEARN");
    return done;
  }, [trace, result?.mission?.id, result?.mission?.state]);

  async function run() {
    setRunning(true); setError(""); setResult(null);
    const publicProblems: Record<keyof typeof domains, string> = {
      Growth: "Ruch na stronie rośnie, ale konwersja checkout jest słaba. Zdiagnozuj główne wąskie gardło i wskaż pierwszy krok.",
      Sales: "Mamy dużo leadów, ale czas odpowiedzi jest zbyt długi, a współczynnik wygranych transakcji spada. Co należy zbadać najpierw?",
      Operations: "Backlog operacyjny rośnie, a zespół pracuje blisko pełnej przepustowości. Co należy zdiagnozować przed zwiększeniem zatrudnienia?"
    };
    try {
      const r = await fetch("/api/investor-demo", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ problem: publicProblems[domain] }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "BŁĄD ANALIZY AGENTA");
      const confidence = Number(data.solution?.confidence || 0);
      setResult({
        ok: true, engine: "Core Engine AI", version: "public-investor-v1", state: "ANALYZED",
        decision: { recommendation: data.solution?.recommendation, diagnosis: data.solution?.diagnosis, priority: data.solution?.priority, confidence, riskGate: "PRZEJŚCIE", reasoningSource: "Core Engine AI", evidence: data.evidence || [] },
        evidence: data.evidence || [], evidenceQuality: data.evidenceQuality,
        trace: (data.trace || []).map((x: Json) => ({ ...x, status: "GOTOWE" })),
        audit: { algorithm: "Public simulation provenance", integrity: "SIMULATED", chainLength: (data.trace || []).length },
        mission: null, simulation: true
      });
    } catch (e) { setError(e instanceof Error ? e.message : "BŁĄD ANALIZY AGENTA"); }
    finally { setRunning(false); }
  }

  async function analyzeVisitorProblem() {
    const problem = agentQuestion.trim();
    if (problem.length < 12) {
      setAgentError("Opisz problem trochę dokładniej — minimum 12 znaków.");
      return;
    }
    setAgentRunning(true); setAgentError(""); setAgentAnalysis(null);
    try {
      const r = await fetch("/api/investor-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ problem })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "INVESTOR_ANALYSIS_FAILED");
      setAgentAnalysis(data);
    } catch (e) {
      setAgentError(e instanceof Error ? e.message : "INVESTOR_ANALYSIS_FAILED");
    } finally { setAgentRunning(false); }
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
  const next = state === "AWAITING_APPROVAL" ? "approve" : state === "APPROVED" ? "execute" : state === "EXECUTING" ? "measure" : state === "MEASURING" ? "complete" : state === "GOTOWED" ? "learn" : "";
  const evidenceScore = result?.evidenceQuality?.score;
  const confidence = Number(result?.decision?.confidence);

  return <section className="ultra-shell" id="top">
    <div className="ultra-noise" />
    <div className="ultra-orbit ultra-o1" /><div className="ultra-orbit ultra-o2" /><div className="ultra-orbit ultra-o3" />
    <header className="ultra-topbar">
      <div className="ultra-brand"><span><BrainCircuit size={18}/></span><b>RDZEŃ SILNIK</b><small>CENTRUM STEROWANIA AI</small></div>
      <div className="ultra-live"><i /> AKTYWNA WARSTWA INTELIGENCJI</div>
      <div className="ultra-toplinks"><a href="#portfolio">PRODUKTY <ArrowRight size={13}/></a><a href="#roadmap">PLAN ROZWOJU</a></div>
    </header>

    <div className="ultra-hero">
      <div className="ultra-kicker"><span>DOŚWIADCZENIE INWESTORSKIE 03</span><em>AGENT RUNTIME · {agent?.runtime?.status || "ŁĄCZENIE"}</em></div>
      <h1>Inteligencja<br/><span>w działaniu.</span></h1>
      <p>One control plane turns fragmented business signals into evidence, decisions, governed missions and measurable learning. The same agent contract powers every product surface.</p>
      <div className="ultra-hero-actions"><a className="ultra-primary" href="#ultra-demo"><Play size={15}/> URUCHOM RDZEŃ</a><a className="ultra-secondary" href="#ultra-map">POKAŻ MAPĘ SYSTEMU <ArrowRight size={14}/></a></div>
      <div className="ultra-proof"><span><ShieldCheck size={14}/> najpierw dowody</span><span><LockKeyhole size={14}/> granica akceptacji</span><span><GitBranch size={14}/> audytowalny stan</span></div>
    </div>

    <section className="ultra-agent-lab" id="agent-lab">
      <div className="ultra-agent-lab-head">
        <div>
          <span className="ultra-label">00 / POKAŻ AGENTA</span>
          <h2>Daj nam problem.<br/><i>Zobacz, jak myśli rdzeń.</i></h2>
          <p>Opisz realny problem biznesowy własnymi słowami. The publiczne demo converts it into context, evidence, diagnosis and a governed solution proposal. No prywatnych systemów are accessed and no działania zewnętrznego is executed.</p>
        </div>
        <div className="ultra-agent-badge"><BrainCircuit size={17}/> SWOBODNE DEMO AGENTA <span>SYMULACJA</span></div>
      </div>
      <div className="ultra-agent-prompts">
        <span>WYPRÓBUJ PYTANIE BIZNESOWE</span>
        {agentPrompts.map((prompt, i) => <button key={i} onClick={() => { setAgentQuestion(prompt); setAgentError(""); }}>{prompt}</button>)}
      </div>
      <div className="ultra-agent-input">
        <textarea
          value={agentQuestion}
          onChange={e => setAgentQuestion(e.target.value)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyzeVisitorProblem(); }}
          placeholder="Przykład: Our website gets 20,000 visits a month, but very few visitors complete checkout. What should we investigate first?"
          maxLength={2400}
          aria-label="Describe a business problem for the Core Engine"
        />
        <div className="ultra-agent-input-footer">
          <span>{agentQuestion.length}/2400 · Ctrl/Cmd + Enter</span>
          <button onClick={analyzeVisitorProblem} wyłączone={agentRunning}>
            {agentRunning ? <><Sparkles className="ultra-spin" size={15}/> ANALIZA...</> : <><Zap size={15}/> ANALIZUJ MÓJ PROBLEM</>}
          </button>
        </div>
      </div>
      {agentAnalysis && <div className="ultra-agent-output">
        <div className="ultra-agent-output-top">
          <div><span className="ultra-label">AGENT ANALYSIS · {String(agentAnalysis.domain || "business").toUpperCase()}</span><h3>{agentAnalysis.solution?.diagnosis || "Wygenerowana diagnoza"}</h3></div>
          <div className="ultra-agent-confidence"><small>PEWNOŚĆ</small><b>{Math.round(Number(agentAnalysis.solution?.confidence || 0) * 100)}%</b></div>
        </div>
        <div className="ultra-agent-grid">
          <article><span>01 / REKOMENDACJA</span><strong>{agentAnalysis.solution?.recommendation}</strong></article>
          <article><span>02 / PRIORYTET</span><strong>{agentAnalysis.solution?.priority}</strong><small>Jakość dowodów: {agentAnalysis.evidenceQuality?.score ?? "N/A"}</small></article>
          <article><span>03 / NASTĘPNE DZIAŁANIA</span><div>{(agentAnalysis.solution?.actions || []).slice(0, 4).map((a: Json, i: number) => <p key={i}><b>{String(i + 1).padStart(2, "0")}</b>{a.action}</p>)}</div></article>
        </div>
        <div className="ultra-agent-layers"><span>KONTEKST</span><span>DOWODY</span><span>DIAGNOZA</span><span>DECYZJA</span><span>ZARZĄDZANIE</span></div>
        <div className="ultra-agent-trace">{(agentAnalysis.trace || []).map((x: Json) => <span key={x.stage}><i/>{x.stage}</span>)}</div>
        <small className="ultra-agent-disclaimer">{agentAnalysis.disclaimer}</small>
      </div>}
      {agentError && <div className="ultra-error">AGENT DEMO · {agentError}</div>}
    </section>

    <div className="ultra-command" id="ultra-demo">
      <div className="ultra-command-head"><div><span className="ultra-label">01 / WEJŚCIE SYGNAŁÓW · SYMULOWANE DANE</span><h2>Daj rdzeniowi sytuację biznesową.</h2></div><div className="ultra-runtime"><i/>{agent?.runtime?.status || runtime?.status || "ŁĄCZENIE"} <b>{runtime?.version || "RDZEŃ"}</b></div></div>
      <div className="ultra-input-grid">
        <div className="ultra-domain-tabs">{(Object.keys(domains) as Array<keyof typeof domains>).map(d => <button key={d} onClick={() => setDomain(d)} className={d === domain ? "active" : ""}><Activity size={14}/>{{Growth:"Rozwój",Sales:"Sprzedaż",Operations:"Operacje"}[d]}</button>)}</div>
        <div className="ultra-signals">{domains[domain].map(s => <div key={s.name}><small>{s.source}</small><b>{s.name}</b><strong>{s.value}</strong></div>)}</div>
        <button className="ultra-run" onClick={run} wyłączone={running}>{running ? <><Sparkles className="ultra-spin" size={16}/> ANALIZA...</> : <><Zap size={16}/> AKTYWUJ RDZEŃ</>}</button>
      </div>

      <div className="ultra-statebar">
        {stages.map((stage, i) => <div key={stage} className={completed.has(["OBSERVE","CONTEXT","EVIDENCE","DIAGNOSE","DECIDE","MISSION","APPROVAL","EXECUTE","MEASURE","LEARN"][i]) ? "done" : ""}><span>{completed.has(["OBSERVE","CONTEXT","EVIDENCE","DIAGNOSE","DECIDE","MISSION","APPROVAL","EXECUTE","MEASURE","LEARN"][i]) ? <CheckCircle2 size={13}/> : <Circle size={13}/>}</span><b>{stage}</b>{i < stages.length - 1 && <i/>}</div>)}
      </div>

      {result && <div className="ultra-results">
        <div className="ultra-result-head"><div><span className="ultra-label">02 / WYNIK ANALIZY</span><h2>{result.engine || "RDZEŃ SILNIK"}<small> · {result.version || "runtime"}</small></h2></div><div className="ultra-state"><i/>{result.state || "ANALYZED"}</div></div>
        <div className="ultra-agent-strip"><span>AGENT CONTRACT</span><b>{agent?.agent?.name || "Core Engine Agent"}</b><small>{agent?.agent?.contract || "agent-runtime"} · {agent?.agent?.autonomy || "WYMAGA AKCEPTACJI CZŁOWIEKA"} · {agent?.runtime?.persistence || "runtime persistence"} · {agent?.runtime?.capabilityPacks ?? 0} capability packs · zewnętrzne skutki {agent?.runtime?.liveExternalSideEffects ? "enabled" : "wyłączone"}</small></div><div className="ultra-metrics">
          <div><small>PEWNOŚĆ</small><strong>{Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "N/A"}</strong><span>decision matrix</span></div>
          <div><small>DOWODY QUALITY</small><strong>{typeof evidenceScore === "number" ? `${evidenceScore}` : "N/A"}</strong><span>provenance score</span></div>
          <div><small>RISK GATE</small><strong>{result.decision?.riskGate || "PRZEJŚCIE"}</strong><span>policy evaluation</span></div>
          <div><small>ŁAŃCUCH AUDYTU</small><strong>{result.audit?.chainLength ?? 0}</strong><span>{result.audit?.integrity || "pending"}</span></div>
        </div>
        <div className="ultra-decision"><div className="ultra-decision-main"><span className="ultra-label">DECYZJA CENTER</span><h3>{result.decision?.recommendation || "Decision generated"}</h3><p>{result.decision?.diagnosis || "The core has processed the supplied signals."}</p></div><div className="ultra-decision-side"><small>PRIORYTET</small><b>{result.decision?.priority || "N/A"}</b><small>ŹRÓDŁO ROZUMOWANIA</small><b>{result.decision?.reasoningSource || "Core"}</b></div></div>
        <div className="ultra-evidence"><div className="ultra-label">DOWODY GRAPH</div>{(result.decision?.evidence || result.evidence || []).slice(0, 8).map((e: any, i: number) => <div key={typeof e === "string" ? e : e.id || i}><span>{String(i + 1).padStart(2,"0")}</span><b>{typeof e === "string" ? e : e.claim || e.id || "evidence node"}</b><small>{typeof e === "string" ? "zweryfikowany węzeł" : e.source || "source"}</small></div>)}</div>
        {result.mission && <div className="ultra-mission"><div><span className="ultra-label">STEROWANIE MISJĄ</span><h3>{result.mission.objective}</h3><p>Aktualny stan: <b>{state}</b> · kontrolowane przejście · weryfikacja wyniku demo aktywna</p></div><div className="ultra-mission-actions">{next ? <button onClick={() => mission(next)} wyłączone={missionBusy}>{missionBusy ? <Sparkles className="ultra-spin" size={14}/> : <ArrowRight size={14}/>} {missionBusy ? "PRZETWARZANIE" : next.toUpperCase()}</button> : <span><CheckCircle2 size={15}/> LEARNING GOTOWE</span>}</div></div>}
        {result.audit && <div className="ultra-audit"><div><span className="ultra-label">ŁAŃCUCH AUDYTU</span><h3>{result.audit.algorithm || "Cryptographic provenance"}</h3></div><code>HEAD · {result.audit.head || "N/A"}</code><b>{result.audit.integrity}</b></div>}
      </div>}
      {error && <div className="ultra-error">RDZEŃ ERROR · {error}</div>}
    </div>

    <div className="ultra-commercial" id="commercial">
      <div className="ultra-section-title"><span>03.5 / KOMERCYJNY KONTRAKT AGENTA</span><h2>Od działającej inteligencji<br/><i>do produktu gotowego do sprzedaży.</i></h2></div>
      <div className="ultra-commercial-grid">
        <div className="ultra-commercial-card">
          <span className="ultra-label">COMMERCIAL RUNTIME · {commercial?.contract || "commercial-agent-v1"}</span>
          <h3>Wielodostępna infrastruktura agenta</h3>
          <p>Tożsamość, izolacja tenantów/workspace'ów, pomiar użycia i limity planów są jawnie zdefiniowanymi kontraktami produktu. Trwała persystencja produkcyjna pozostaje oparta o Supabase.</p>
          <div className="ultra-commercial-status"><b>{commercial?.product?.identity || "SUPABASE_AUTH"}</b><b>{commercial?.product?.tenancy || "TENANT_WORKSPACE"}</b><b>{commercial?.product?.metering || "DATABASE_ENFORCED"}</b><b>{commercial?.product?.billing || "INTERNAL_PLAN_V1"}</b></div>
        </div>
        <div className="ultra-commercial-card">
          <span className="ultra-label">MODEL PLANÓW</span>
          <div className="ultra-plans">{(commercial?.plans || []).map((plan: Json) => <div key={plan.id}><b>{String(plan.id).toUpperCase()}</b><strong>{plan.monthlyUnits === null ? "INDYWIDUALNY" : String(plan.monthlyUnits) + " jednostek"}</strong></div>)}</div>
          <small>High-risk actions require approval · zewnętrzne skutki remain wyłączone in the investor runtime.</small>
        </div>
      </div>
    </div>

    <div className="ultra-map" id="ultra-map">
      <div className="ultra-section-title"><span>03 / WARSTWA INTELIGENCJI</span><h2>Jeden rdzeń.<br/><i>Siedem warstw sterowania.</i></h2></div>
      <div className="ultra-layer-stack">{[
        ["01","KONTEKST SILNIK","Normalizuje sygnały, domenę i kontekst operacyjny",Database],
        ["02","DOWODY GRAPH","Łączy twierdzenia, źródła i proweniencję",Radar],
        ["03","DECYZJA MATRIX","Ocenia priorytet, pewność i rekomendację",Gauge],
        ["04","RISK GATE","Stosuje politykę przed działaniem o konsekwencjach",ShieldCheck],
        ["05","MISSION SILNIK","Zamienia decyzje w pracę ze stanem",Target],
        ["06","CAPABILITY FABRIC","Mapuje zatwierdzone misje na kontrolowane działania",Zap],
        ["07","OUTCOME + LEARNING","Mierzy wyniki i zasila kolejną decyzję",BrainCircuit],
      ].map(([n,t,d,Icon]) => <article key={n as string}><span>{n as string}</span><Icon size={18}/><div><b>{t as string}</b><p>{d as string}</p></div><ArrowRight size={14}/></article>)}</div>
    </div>

    <div className="ultra-portfolio" id="portfolio">
      <div className="ultra-section-title"><span>04 / POWIERZCHNIE PRODUKTOWE</span><h2>Ta sama inteligencja.<br/><i>Trzy środowiska.</i></h2></div>
      <div className="ultra-products">
        <article className="u-orange"><Target/><small>01 / DECYZJA INTELLIGENCE</small><h3>Bet Builder</h3><p>Events → analysis → research → evidence → decision → mission.</p><b>WARSTWA DOWODOWA</b></article>
        <article className="u-violet"><Gauge/><small>02 / BUSINESS OPERATING SYSTEM</small><h3>Growth Advisor</h3><p>Website audit → opportunity → Growth Mission → approval → outcome.</p><b>RDZEŃ PRODUCT</b></article>
        <article className="u-green"><Radar/><small>03 / OPPORTUNITY INTELLIGENCE</small><h3>Extra Szpieg</h3><p>Scan → provenance → opportunity → BUY / WATCH / PRZEJŚCIE → alerts.</p><b>LABORATORIUM PRODUKTU</b></article>
      </div>
    </div>

    <div className="ultra-roadmap" id="roadmap"><div className="ultra-section-title"><span>05 / PLATFORM PLAN ROZWOJU</span><h2>Od działającego rdzenia<br/><i>do skalowalnej platformy.</i></h2></div><div className="ultra-roadmap-grid">{[["01","RDZEŃ","Agent contract, evidence, decisions and mission lifecycle"],["02","PRODUCTS","Bet Builder, Growth Advisor and Extra Szpieg as proof surfaces"],["03","DATA","Connectors, provenance and durable business context"],["04","AUTONOMY","Governed capability execution behind approval policies"],["05","LEARNING","Outcome feedback and reusable intelligence"],["06","PLATFORM","Tenancy, auth, metering and enterprise control"]].map(([n,t,d]) => <article key={n}><span>{n}</span><b>{t}</b><p>{d}</p><i/></article>)}</div></div><footer className="ultra-footer"><div><BrainCircuit size={17}/> RDZEŃ SILNIK AI</div><span>JEDEN RDZEŃ INTELIGENCJI · WIELE BIZNESÓW</span><a href="#top">WRÓĆ NA GÓRĘ ↑</a></footer>
  </section>;
}
