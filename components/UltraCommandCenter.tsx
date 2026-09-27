"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Circle, Database, Gauge, GitBranch, LockKeyhole, Play, Radar, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";

type Json = Record<string, any>;
const domains = {
  Growth: [{ name: "Współczynnik konwersji", value: "2.8%", source: "analityka" }, { name: "Ruch", value: "+18%", source: "analityka" }, { name: "Porzucenie zakupu", value: "41%", source: "lejek" }],
  Sales: [{ name: "Kwalifikowane leady", value: "-14%", source: "CRM" }, { name: "Czas odpowiedzi", value: "11 h", source: "CRM" }, { name: "Współczynnik wygranych", value: "18%", source: "sprzedaż" }],
  Operations: [{ name: "Zaległości zamówień", value: "+27%", source: "operacje" }, { name: "Czas cyklu", value: "3,4 dnia", source: "ERP" }, { name: "Wykorzystanie przepustowości", value: "82%", source: "zasoby zespołu" }],
} as const;
const stageIds = ["OBSERVE", "CONTEXT", "EVIDENCE", "DIAGNOSE", "DECIDE", "MISSION", "APPROVAL", "EXECUTE", "MEASURE", "LEARN"];
const stages = ["OBSERWUJ", "KONTEKST", "DOWODY", "DIAGNOZA", "DECYZJA", "MISJA", "AKCEPTACJA", "WYKONANIE", "POMIAR", "UCZENIE"];

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
    "Mamy dużo leadów, ale czas odpowiedzi jest zbyt długi, a współczynnik wygranych transakcji spada. Co powinniśmy zbadać?",
    "Ruch rośnie, ale konwersja zakupów jest słaba. Znajdź prawdopodobne wąskie gardło i zaproponuj pierwszy eksperyment.",
    "Zaległości operacyjne rosną, a zespół jest blisko pełnej przepustowości. Co powinniśmy zdiagnozować przed zwiększeniem zatrudnienia?",
    "Odpływ klientów rośnie. Jak uporządkować analizę i zdecydować, co zmienić jako pierwsze?"
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
        ok: true, engine: "Core Engine AI", version: "public-investor-v1", state: "PRZEANALIZOWANO",
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
      if (!r.ok) throw new Error(data.error || "BŁĄD ANALIZY DEMO");
      setAgentAnalysis(data);
    } catch (e) {
      setAgentError(e instanceof Error ? e.message : "BŁĄD ANALIZY DEMO");
    } finally { setAgentRunning(false); }
  }

  async function mission(action: string) {
    if (!result?.mission?.id) return;
    setMissionBusy(true); setError("");
    try {
      const r = await fetch("/api/mission", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ id: result.mission.id, action, idempotencyKey: crypto.randomUUID(), outcome: { before: 100, after: action === "measure" ? 112 : 120, direction: "higher" } }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "BŁĄD OPERACJI MISJI");
      setResult((old: Json) => ({ ...old, ...data, mission: data.mission, state: data.mission?.state, trace: data.trace ?? old.trace }));
    } catch (e) { setError(e instanceof Error ? e.message : "BŁĄD OPERACJI MISJI"); }
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
      <div className="ultra-kicker"><span>DOŚWIADCZENIE INWESTORSKIE 03</span><em>ŚRODOWISKO AGENTA · {agent?.runtime?.status || "ŁĄCZENIE"}</em></div>
      <h1>Inteligencja<br/><span>w działaniu.</span></h1>
      <p>Jeden centralny system sterowania zamienia rozproszone sygnały biznesowe w dowody, decyzje, zarządzane misje i mierzalne uczenie. Ten sam kontrakt agenta zasila każdą powierzchnię produktu.</p>
      <div className="ultra-hero-actions"><a className="ultra-primary" href="#ultra-demo"><Play size={15}/> URUCHOM RDZEŃ</a><a className="ultra-secondary" href="#ultra-map">POKAŻ MAPĘ SYSTEMU <ArrowRight size={14}/></a></div>
      <div className="ultra-proof"><span><ShieldCheck size={14}/> najpierw dowody</span><span><LockKeyhole size={14}/> granica akceptacji</span><span><GitBranch size={14}/> audytowalny stan</span></div>
    </div>

    <section className="ultra-agent-lab" id="agent-lab">
      <div className="ultra-agent-lab-head">
        <div>
          <span className="ultra-label">00 / POKAŻ AGENTA</span>
          <h2>Daj nam problem.<br/><i>Zobacz, jak myśli rdzeń.</i></h2>
          <p>Opisz realny problem biznesowy własnymi słowami. Publiczne demo zamienia go w kontekst, dowody, diagnozę i zarządzaną propozycję rozwiązania. Nie są używane prywatne systemy i nie są wykonywane żadne działania zewnętrzne.</p>
        </div>
        <div className="ultra-agent-badge"><BrainCircuit size={17}/> PUBLICZNE DEMO AGENTA <span>SYMULACJA</span></div>
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
          placeholder="Przykład: Mamy 20 000 wizyt miesięcznie, ale bardzo mało osób kończy zakup. Co powinniśmy zbadać najpierw?"
          maxLength={2400}
          aria-label="Opisz problem biznesowy dla Core Engine"
        />
        <div className="ultra-agent-input-footer">
          <span>{agentQuestion.length}/2400 · Ctrl/Cmd + Enter</span>
          <button onClick={analyzeVisitorProblem} disabled={agentRunning}>
            {agentRunning ? <><Sparkles className="ultra-spin" size={15}/> ANALIZA...</> : <><Zap size={15}/> ANALIZUJ MÓJ PROBLEM</>}
          </button>
        </div>
      </div>
      {agentAnalysis && <div className="ultra-agent-output">
        <div className="ultra-agent-output-top">
          <div><span className="ultra-label">ANALIZA AGENTA · {String(agentAnalysis.domain || "biznes").toUpperCase()}</span><h3>{agentAnalysis.solution?.diagnosis || "Wygenerowana diagnoza"}</h3></div>
          <div className="ultra-agent-confidence"><small>PEWNOŚĆ</small><b>{Math.round(Number(agentAnalysis.solution?.confidence || 0) * 100)}%</b></div>
        </div>
        <div className="ultra-agent-grid">
          <article><span>01 / REKOMENDACJA</span><strong>{agentAnalysis.solution?.recommendation}</strong></article>
          <article><span>02 / PRIORYTET</span><strong>{agentAnalysis.solution?.priority}</strong><small>Jakość dowodów: {agentAnalysis.evidenceQuality?.score ?? "brak danych"}</small></article>
          <article><span>03 / NASTĘPNE DZIAŁANIA</span><div>{(agentAnalysis.solution?.actions || []).slice(0, 4).map((a: Json, i: number) => <p key={i}><b>{String(i + 1).padStart(2, "0")}</b>{a.action}</p>)}</div></article>
        </div>
        <div className="ultra-agent-layers"><span>KONTEKST</span><span>DOWODY</span><span>DIAGNOZA</span><span>DECYZJA</span><span>ZARZĄDZANIE</span></div>
        {agentAnalysis.explainability && <div className="ultra-agent-explainability">
          <div><span className="ultra-label">JAWNOŚĆ DECYZJI</span><h4>Rdzeń pokazuje nie tylko odpowiedź, ale także granice wiedzy.</h4></div>
          <div className="ultra-agent-explain-grid">
            <article><small>NIEPEWNOŚĆ</small><b>{agentAnalysis.explainability.uncertainty}</b><p>Pewność modelu: {Math.round(Number(agentAnalysis.explainability.confidence || 0) * 100)}%</p></article>
            <article><small>POLITYKA DECYZJI</small><b>ODWRACALNE DZIAŁANIE</b><p>{agentAnalysis.explainability.policy}</p></article>
            <article><small>BRAMA WYKONANIA</small><b>{agentAnalysis.explainability.execution}</b></article>
          </div>
          <div className="ultra-agent-gaps"><div><small>BRAKUJĄCE DOWODY</small>{(agentAnalysis.explainability.evidenceGaps || []).map((x: string, i: number) => <p key={i}><b>{String(i + 1).padStart(2, "0")}</b>{x}</p>)}</div><div><small>NASTĘPNY PAKIET DOWODÓW</small>{(agentAnalysis.explainability.nextEvidence || []).map((x: string, i: number) => <p key={i}><b>{String(i + 1).padStart(2, "0")}</b>{x}</p>)}</div></div>
        </div>}
        <div className="ultra-agent-trace">{(agentAnalysis.trace || []).map((x: Json) => <span key={x.stage}><i/>{({OBSERVE:"OBSERWUJ",CONTEXT:"KONTEKST",EVIDENCE:"DOWODY",DIAGNOSE:"DIAGNOZA",DECIDE:"DECYZJA",APPROVAL:"AKCEPTACJA",MISSION:"MISJA",EXECUTE:"WYKONANIE",MEASURE:"POMIAR",LEARN:"UCZENIE"} as Record<string,string>)[x.stage] || x.stage}</span>)}</div>
        <small className="ultra-agent-disclaimer">{agentAnalysis.disclaimer}</small>
      </div>}
      {agentError && <div className="ultra-error">DEMO AGENTA · {agentError}</div>}
    </section>

    <div className="ultra-command" id="ultra-demo">
      <div className="ultra-command-head"><div><span className="ultra-label">01 / WEJŚCIE SYGNAŁÓW · SYMULOWANE DANE</span><h2>Daj rdzeniowi sytuację biznesową.</h2></div><div className="ultra-runtime"><i/>{agent?.runtime?.status || runtime?.status || "ŁĄCZENIE"} <b>{runtime?.version || "RDZEŃ"}</b></div></div>
      <div className="ultra-input-grid">
        <div className="ultra-domain-tabs">{(Object.keys(domains) as Array<keyof typeof domains>).map(d => <button key={d} onClick={() => setDomain(d)} className={d === domain ? "active" : ""}><Activity size={14}/>{{Growth:"Rozwój",Sales:"Sprzedaż",Operations:"Operacje"}[d]}</button>)}</div>
        <div className="ultra-signals">{domains[domain].map(s => <div key={s.name}><small>{s.source}</small><b>{s.name}</b><strong>{s.value}</strong></div>)}</div>
        <button className="ultra-run" onClick={run} disabled={running}>{running ? <><Sparkles className="ultra-spin" size={16}/> ANALIZA...</> : <><Zap size={16}/> AKTYWUJ RDZEŃ</>}</button>
      </div>

      <div className="ultra-statebar">
        {stages.map((stage, i) => <div key={stage} className={completed.has(["OBSERVE","CONTEXT","EVIDENCE","DIAGNOSE","DECIDE","MISSION","APPROVAL","EXECUTE","MEASURE","LEARN"][i]) ? "done" : ""}><span>{completed.has(["OBSERVE","CONTEXT","EVIDENCE","DIAGNOSE","DECIDE","MISSION","APPROVAL","EXECUTE","MEASURE","LEARN"][i]) ? <CheckCircle2 size={13}/> : <Circle size={13}/>}</span><b>{stage}</b>{i < stages.length - 1 && <i/>}</div>)}
      </div>

      {result && <div className="ultra-results">
        <div className="ultra-result-head"><div><span className="ultra-label">02 / WYNIK ANALIZY</span><h2>{result.engine || "RDZEŃ SILNIK"}<small> · {result.version || "środowisko"}</small></h2></div><div className="ultra-state"><i/>{result.state || "PRZEANALIZOWANO"}</div></div>
        <div className="ultra-agent-strip"><span>KONTRAKT AGENTA</span><b>{agent?.agent?.name || "Agent Core Engine"}</b><small>{agent?.agent?.contract || "kontrakt-runtime"} · {agent?.agent?.autonomy || "WYMAGA AKCEPTACJI CZŁOWIEKA"} · {agent?.runtime?.persistence || "trwałość runtime"} · {agent?.runtime?.capabilityPacks ?? 0} pakiety kompetencji · zewnętrzne skutki {agent?.runtime?.liveExternalSideEffects ? "aktywne" : "wyłączone"}</small></div><div className="ultra-metrics">
          <div><small>PEWNOŚĆ</small><strong>{Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "brak danych"}</strong><span>macierz decyzji</span></div>
          <div><small>JAKOŚĆ DOWODÓW</small><strong>{typeof evidenceScore === "number" ? `${evidenceScore}` : "brak danych"}</strong><span>wynik proweniencji</span></div>
          <div><small>BRAMA RYZYKA</small><strong>{result.decision?.riskGate || "PRZEJŚCIE"}</strong><span>ocena polityki</span></div>
          <div><small>ŁAŃCUCH AUDYTU</small><strong>{result.audit?.chainLength ?? 0}</strong><span>{result.audit?.integrity || "oczekuje"}</span></div>
        </div>
        <div className="ultra-decision"><div className="ultra-decision-main"><span className="ultra-label">CENTRUM DECYZJI</span><h3>{result.decision?.recommendation || "Wygenerowana decyzja"}</h3><p>{result.decision?.diagnosis || "Rdzeń przetworzył dostarczone sygnały."}</p></div><div className="ultra-decision-side"><small>PRIORYTET</small><b>{result.decision?.priority || "brak danych"}</b><small>ŹRÓDŁO ROZUMOWANIA</small><b>{result.decision?.reasoningSource || "Rdzeń"}</b></div></div>
        <div className="ultra-evidence"><div className="ultra-label">GRAF DOWODÓW</div>{(result.decision?.evidence || result.evidence || []).slice(0, 8).map((e: any, i: number) => <div key={typeof e === "string" ? e : e.id || i}><span>{String(i + 1).padStart(2,"0")}</span><b>{typeof e === "string" ? e : e.claim || e.id || "węzeł dowodowy"}</b><small>{typeof e === "string" ? "zweryfikowany węzeł" : e.source ? ({analytics:"analityka",funnel:"lejek",CRM:"CRM",sales:"sprzedaż",operations:"operacje",workforce:"zasoby zespołu",ERP:"ERP"} as Record<string,string>)[e.source] || e.source : "brak źródła"}</small></div>)}</div>
        {result.mission && <div className="ultra-mission"><div><span className="ultra-label">STEROWANIE MISJĄ</span><h3>{result.mission.objective}</h3><p>Aktualny stan: <b>{state}</b> · kontrolowane przejście · weryfikacja wyniku demo aktywna</p></div><div className="ultra-mission-actions">{next ? <button onClick={() => mission(next)} disabled={missionBusy}>{missionBusy ? <Sparkles className="ultra-spin" size={14}/> : <ArrowRight size={14}/>} {missionBusy ? "PRZETWARZANIE" : next.toUpperCase()}</button> : <span><CheckCircle2 size={15}/> UCZENIE GOTOWE</span>}</div></div>}
        {result.audit && <div className="ultra-audit"><div><span className="ultra-label">ŁAŃCUCH AUDYTU</span><h3>{result.audit.algorithm || "Proweniencja kryptograficzna"}</h3></div><code>HEAD · {result.audit.head || "brak danych"}</code><b>{result.audit.integrity}</b></div>}
      </div>}
      {error && <div className="ultra-error">BŁĄD RDZENIA · {error}</div>}
    </div>

    <div className="ultra-commercial" id="commercial">
      <div className="ultra-section-title"><span>03.5 / KOMERCYJNY KONTRAKT AGENTA</span><h2>Od działającej inteligencji<br/><i>do produktu gotowego do sprzedaży.</i></h2></div>
      <div className="ultra-commercial-grid">
        <div className="ultra-commercial-card">
          <span className="ultra-label">KOMERCYJNE ŚRODOWISKO · {commercial?.contract || "commercial-agent-v1"}</span>
          <h3>Wielodostępna infrastruktura agenta</h3>
          <p>Tożsamość, izolacja tenantów/workspace'ów, pomiar użycia i limity planów są jawnie zdefiniowanymi kontraktami produktu. Trwała persystencja produkcyjna pozostaje oparta o Supabase.</p>
          <div className="ultra-commercial-status"><b>{commercial?.product?.identity === "SUPABASE_AUTH" ? "UWIERZYTELNIANIE SUPABASE" : (commercial?.product?.identity || "brak danych")}</b><b>{commercial?.product?.tenancy === "TENANT_WORKSPACE" ? "PRZESTRZEŃ TENANTA" : (commercial?.product?.tenancy || "brak danych")}</b><b>{commercial?.product?.metering === "DATABASE_ENFORCED" ? "POMIAR Z BAZY DANYCH" : (commercial?.product?.metering || "brak danych")}</b><b>{commercial?.product?.billing === "INTERNAL_PLAN_V1" ? "PLAN WEWNĘTRZNY V1" : (commercial?.product?.billing || "brak danych")}</b></div>
        </div>
        <div className="ultra-commercial-card">
          <span className="ultra-label">MODEL PLANÓW</span>
          <div className="ultra-plans">{(commercial?.plans || []).map((plan: Json) => <div key={plan.id}><b>{String(plan.id).toUpperCase()}</b><strong>{plan.monthlyUnits === null ? "INDYWIDUALNY" : String(plan.monthlyUnits) + " jednostek"}</strong></div>)}</div>
          <small>Działania wysokiego ryzyka wymagają akceptacji · skutki zewnętrzne pozostają wyłączone w środowisku demonstracyjnym.</small>
        </div>
      </div>
    </div>

    <div className="ultra-map" id="ultra-map">
      <div className="ultra-section-title"><span>03 / WARSTWA INTELIGENCJI</span><h2>Jeden rdzeń.<br/><i>Siedem warstw sterowania.</i></h2></div>
      <div className="ultra-layer-stack">{[
        ["01","SILNIK KONTEKSTU","Normalizuje sygnały, domenę i kontekst operacyjny",Database],
        ["02","GRAF DOWODÓW","Łączy twierdzenia, źródła i proweniencję",Radar],
        ["03","MACIERZ DECYZJI","Ocenia priorytet, pewność i rekomendację",Gauge],
        ["04","BRAMA RYZYKA","Stosuje politykę przed działaniem o konsekwencjach",ShieldCheck],
        ["05","SILNIK MISJI","Zamienia decyzje w pracę ze stanem",Target],
        ["06","WARSTWA KOMPETENCJI","Mapuje zatwierdzone misje na kontrolowane działania",Zap],
        ["07","WYNIK + UCZENIE","Mierzy wyniki i zasila kolejną decyzję",BrainCircuit],
      ].map(([n,t,d,Icon]) => <article key={n as string}><span>{n as string}</span><Icon size={18}/><div><b>{t as string}</b><p>{d as string}</p></div><ArrowRight size={14}/></article>)}</div>
    </div>

    <div className="ultra-portfolio" id="portfolio">
      <div className="ultra-section-title"><span>04 / POWIERZCHNIE PRODUKTOWE</span><h2>Ta sama inteligencja.<br/><i>Trzy środowiska.</i></h2></div>
      <div className="ultra-products">
        <article className="u-orange"><Target/><small>01 / INTELIGENCJA DECYZYJNA</small><h3>Bet Builder</h3><p>Zdarzenia → analiza → badanie → dowody → decyzja → misja.</p><b>WARSTWA DOWODOWA</b></article>
        <article className="u-violet"><Gauge/><small>02 / BIZNESOWY SYSTEM OPERACYJNY</small><h3>Growth Advisor</h3><p>Audyt strony → szansa → Misja Rozwoju → akceptacja → wynik.</p><b>RDZEŃ PRODUKTU</b></article>
        <article className="u-green"><Radar/><small>03 / INTELIGENCJA OKAZJI</small><h3>Extra Szpieg</h3><p>Skan → proweniencja → szansa → KUP / OBSERWUJ / ODRZUĆ → alerty.</p><b>LABORATORIUM PRODUKTU</b></article>
      </div>
    </div>

    <div className="ultra-roadmap" id="roadmap"><div className="ultra-section-title"><span>05 / PLAN ROZWOJU PLATFORMY</span><h2>Od działającego rdzenia<br/><i>do skalowalnej platformy.</i></h2></div><div className="ultra-roadmap-grid">{[["01","RDZEŃ","Kontrakt agenta, dowody, decyzje i cykl życia misji"],["02","PRODUKTY","Bet Builder, Growth Advisor i Extra Szpieg jako powierzchnie dowodowe"],["03","DANE","Konektory, proweniencja i trwały kontekst biznesowy"],["04","AUTONOMIA","Zarządzane wykonywanie kompetencji za politykami akceptacji"],["05","UCZENIE","Informacja zwrotna o wynikach i ponownie użyteczna inteligencja"],["06","PLATFORMA","Wielodostępność, uwierzytelnianie, pomiar użycia i kontrola enterprise"]].map(([n,t,d]) => <article key={n}><span>{n}</span><b>{t}</b><p>{d}</p><i/></article>)}</div></div><footer className="ultra-footer"><div><BrainCircuit size={17}/> RDZEŃ SILNIK AI</div><span>JEDEN RDZEŃ INTELIGENCJI · WIELE BIZNESÓW</span><a href="#top">WRÓĆ NA GÓRĘ ↑</a></footer>
  </section>;
}
